import { REPOSITORY_KEYS, SERVICE_KEYS } from '#constants/singleton';
import {
  BOOKING_STATUS,
  BOOKING_STATUS_TRANSITIONS,
  ACTIVE_BOOKING_STATUSES,
  MIN_BOOKING_DURATION_MINUTES,
} from '#constants/booking-status.const';
import { BOOKING_ERROR_CODES } from '#constants/error-codes.const';
import { BUSINESS_TZ } from '#constants/business-hours.const';
import { ValidationError, ConflictError, NotFoundError } from '#configs/error';
import { isAtLeastMinutesApart, toBusinessLocalWeekBoundsUtc } from '#utils/date.util';
import { isExclusionConstraintError } from '#utils/sequelize-error.util';
import { rankAvailableWorkers } from '#utils/worker-availability.util';
import { sequelize } from '#models/index';

const SKIP_CANDIDATE = Symbol('SKIP_CANDIDATE');

const SLOT_RULE_MESSAGES = {
  [BOOKING_ERROR_CODES.NON_WEEKDAY_BOOKING]: 'Bookings can only be made on weekdays (Mon-Fri)',
  [BOOKING_ERROR_CODES.OUTSIDE_BUSINESS_HOURS]: 'Bookings must fall within business hours (09:00-17:00)',
  [BOOKING_ERROR_CODES.HOLIDAY_CLOSURE]: 'Bookings cannot be made on a company holiday',
  [BOOKING_ERROR_CODES.PAST_BOOKING_TIME]: 'Bookings cannot be made for a time that has already passed',
};

export class BookingService {
  constructor({ container }) {
    this.bookingRepository = container.resolve(REPOSITORY_KEYS.BOOKING);
    this.workerRepository = container.resolve(REPOSITORY_KEYS.WORKER);
    this.customerRepository = container.resolve(REPOSITORY_KEYS.CUSTOMER);
    this.bookingAvailabilityService = container.resolve(SERVICE_KEYS.BOOKING_AVAILABILITY);
  }

  async createBooking({ worker_id, customer_id, start_time, end_time }) {
    if (!isAtLeastMinutesApart(start_time, end_time, MIN_BOOKING_DURATION_MINUTES)) {
      throw new ValidationError(`end_time must be at least ${MIN_BOOKING_DURATION_MINUTES} minutes after start_time`);
    }

    const customer = await this.customerRepository.getOne({ where: { id: customer_id } });
    if (!customer) {
      throw new ValidationError('Customer not found', { code: BOOKING_ERROR_CODES.CUSTOMER_NOT_FOUND });
    }

    const slotCheck = await this.bookingAvailabilityService.checkSlotRules(start_time, end_time);
    if (!slotCheck.ok) {
      throw this._slotRuleError(slotCheck.code);
    }

    const candidateIds = await this._buildCandidateOrder(worker_id, start_time, end_time);

    const result = await this._tryCandidates(candidateIds, async (candidateId, transaction) => {
      const free = await this.bookingAvailabilityService.isWorkerFree(candidateId, start_time, end_time, {
        transaction,
      });
      if (!free) throw SKIP_CANDIDATE;

      const booking = await this.bookingRepository.create(
        { worker_id: candidateId, customer_id, start_time, end_time, status: BOOKING_STATUS.PENDING },
        { transaction }
      );
      return this._toAssignmentResult(booking, candidateId, worker_id);
    });

    if (!result) {
      throw new ConflictError('No worker is available for this time slot', {
        code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
      });
    }
    return result;
  }

  async rescheduleBooking(id, { start_time, end_time }) {
    if (!isAtLeastMinutesApart(start_time, end_time, MIN_BOOKING_DURATION_MINUTES)) {
      throw new ValidationError(`end_time must be at least ${MIN_BOOKING_DURATION_MINUTES} minutes after start_time`);
    }

    const booking = await this.bookingRepository.getOne({ where: { id } });
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
      throw new ConflictError(`Cannot reschedule a booking with status ${booking.status}`);
    }

    const slotCheck = await this.bookingAvailabilityService.checkSlotRules(start_time, end_time);
    if (!slotCheck.ok) {
      throw this._slotRuleError(slotCheck.code);
    }

    const originalWorkerId = booking.worker_id;
    const nextStatus = this._resolveRescheduleStatus(booking, start_time, end_time);
    const candidateIds = await this._buildCandidateOrder(originalWorkerId, start_time, end_time);

    const result = await this._tryCandidates(candidateIds, async (candidateId, transaction) => {
      const free = await this.bookingAvailabilityService.isWorkerFree(candidateId, start_time, end_time, {
        transaction,
        excludeId: id,
      });
      if (!free) throw SKIP_CANDIDATE;

      const updated = await this.bookingRepository.update(
        { id },
        { worker_id: candidateId, start_time, end_time, status: nextStatus },
        { transaction }
      );
      return this._toAssignmentResult(updated, candidateId, originalWorkerId);
    });

    if (!result) {
      throw new ConflictError('No worker is available for this time slot', {
        code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
      });
    }
    return result;
  }

  async updateStatus(id, nextStatus) {
    const booking = await this.bookingRepository.getOne({ where: { id } });
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const allowed = BOOKING_STATUS_TRANSITIONS[booking.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new ConflictError(`Cannot transition booking from ${booking.status} to ${nextStatus}`);
    }

    if (nextStatus === BOOKING_STATUS.COMPLETED) {
      // COMPLETED is terminal (never transitioned out of), so this hour count is
      // added to workers.total_hours exactly once, atomically, in the same
      // transaction as the status flip.
      const hours = (new Date(booking.end_time) - new Date(booking.start_time)) / (1000 * 60 * 60);
      return sequelize.transaction(async (transaction) => {
        const updated = await this.bookingRepository.update({ id }, { status: nextStatus }, { transaction });
        await this.workerRepository.incrementTotalHours(booking.worker_id, hours, { transaction });
        return updated;
      });
    }

    return this.bookingRepository.update({ id }, { status: nextStatus });
  }

  /**
   * "Deleting" a booking is a soft-delete: transitions it to CANCELLED via the same
   * validated transition logic as updateStatus (still blocked from COMPLETED/CANCELLED,
   * still terminal once cancelled). The row is kept — needed for history, and the DB's
   * EXCLUDE constraint/booked-hours queries already treat CANCELLED as "not occupying"
   * a slot, so this fully frees the worker's time without ever deleting the record.
   */
  async cancelBooking(id) {
    return this.updateStatus(id, BOOKING_STATUS.CANCELLED);
  }

  async listByWorker(workerId, { from, to } = {}) {
    return this.bookingRepository.listByWorker(workerId, { from, to });
  }

  async listByCustomer(customerId, { from, to } = {}) {
    return this.bookingRepository.listByCustomer(customerId, { from, to });
  }

  async getById(id) {
    const booking = await this.bookingRepository.getOne({ where: { id } });
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    return booking;
  }

  /**
   * Manually moves one still-open, not-yet-started booking off its current worker onto
   * whichever other active worker is now free for that same time slot — e.g. after a
   * cancellation or a new registration frees up capacity that didn't exist when a
   * worker-deactivation attempt previously failed on this exact booking. Does not touch
   * start_time/end_time. The current worker is never offered back as its own replacement.
   */
  async reassignBooking(id) {
    const booking = await this.bookingRepository.getOne({ where: { id } });
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
      throw new ConflictError(`Cannot reassign a booking with status ${booking.status}`);
    }

    const startISO = booking.start_time.toISOString();
    const endISO = booking.end_time.toISOString();
    if (new Date(startISO) < new Date()) {
      throw new ConflictError('Cannot reassign a booking whose time has already passed', {
        code: BOOKING_ERROR_CODES.PAST_BOOKING_TIME,
      });
    }

    const currentWorkerId = booking.worker_id;
    const candidateIds = (await this._buildCandidateOrder(currentWorkerId, startISO, endISO)).filter(
      (candidateId) => candidateId !== currentWorkerId
    );

    const result = await this._tryCandidates(candidateIds, async (candidateId, transaction) => {
      const free = await this.bookingAvailabilityService.isWorkerFree(candidateId, startISO, endISO, {
        transaction,
        excludeId: id,
      });
      if (!free) throw SKIP_CANDIDATE;

      const updated = await this.bookingRepository.update({ id }, { worker_id: candidateId }, { transaction });
      return this._toAssignmentResult(updated, candidateId, currentWorkerId);
    });

    if (!result) {
      throw new ConflictError('No worker is available to take over this booking', {
        code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
      });
    }
    return result;
  }

  _toAssignmentResult(bookingInstance, assignedWorkerId, requestedWorkerId) {
    const reassigned = assignedWorkerId !== requestedWorkerId;
    return {
      ...bookingInstance.toJSON(),
      reassigned,
      ...(reassigned ? { requested_worker_id: requestedWorkerId } : {}),
    };
  }

  _slotRuleError(code) {
    return new ValidationError(SLOT_RULE_MESSAGES[code] ?? 'This time slot cannot be booked', { code });
  }

  /**
   * A CONFIRMED booking keeps its confirmation only if the new slot stays fully
   * within the slot that was actually confirmed. Any reschedule that adds time
   * outside that window (earlier start, later end, or a full shift) reverts to
   * PENDING since that new time was never confirmed. PENDING bookings are
   * unaffected either way.
   */
  _resolveRescheduleStatus(booking, startISO, endISO) {
    if (booking.status !== BOOKING_STATUS.CONFIRMED) return booking.status;

    const currentStart = new Date(booking.start_time).getTime();
    const currentEnd = new Date(booking.end_time).getTime();
    const newStart = new Date(startISO).getTime();
    const newEnd = new Date(endISO).getTime();
    const staysWithinConfirmedSlot = newStart >= currentStart && newEnd <= currentEnd;

    return staysWithinConfirmedSlot ? BOOKING_STATUS.CONFIRMED : BOOKING_STATUS.PENDING;
  }

  /**
   * [primaryWorkerId, ...other active workers with no overlap, ranked ascending by their
   * total occupied hours (PENDING+CONFIRMED+COMPLETED) for the business-local week
   * containing the slot] — so a worker who's already loaded up toward the weekly hours
   * cap is offered last, spreading assignment/reassignment load across the week rather
   * than just that single day. `primaryWorkerId` is only included if it's actually an
   * active, registered worker — a request for a nonexistent/inactive worker_id must not
   * be silently accepted just because no overlapping booking happens to exist for that id
   * yet. Accepts an optional `transaction` so callers that are already inside one (e.g.
   * mass reassignment during worker deactivation) see their own prior, uncommitted writes.
   */
  async _buildCandidateOrder(primaryWorkerId, startISO, endISO, { transaction } = {}) {
    const activeWorkers = await this.workerRepository.listActive({ transaction });
    const activeIds = activeWorkers.map((worker) => worker.id);
    const primaryIsActive = activeIds.includes(primaryWorkerId);
    const otherIds = activeIds.filter((id) => id !== primaryWorkerId);

    if (!otherIds.length) return primaryIsActive ? [primaryWorkerId] : [];

    const { weekStart, weekEnd } = toBusinessLocalWeekBoundsUtc(startISO, BUSINESS_TZ);
    const rows = await this.workerRepository.getAvailability(
      otherIds,
      { start: startISO, end: endISO, windowStart: weekStart, windowEnd: weekEnd },
      { transaction }
    );
    const ranked = rankAvailableWorkers(rows);
    const rankedIds = ranked.map((row) => row.worker_id);
    return primaryIsActive ? [primaryWorkerId, ...rankedIds] : rankedIds;
  }

  /**
   * Reassigns every still-open (PENDING/CONFIRMED), not-yet-started booking away from
   * `workerId` to another active worker free for that exact slot — used when deactivating
   * a worker. All-or-nothing: if even one booking has no available replacement, this throws
   * and the caller's transaction must roll back (partial reassignment would strand some
   * bookings on a worker about to go inactive). Bookings that are already COMPLETED/
   * CANCELLED, or PENDING/CONFIRMED but already in the past, are left untouched — the former
   * don't need reassignment, the latter can't be meaningfully reassigned to anyone else.
   */
  async reassignBookingsFromWorker(workerId, { transaction } = {}) {
    const bookings = await this.bookingRepository.listReassignableForWorker(workerId, { transaction });
    const reassignments = [];

    for (const booking of bookings) {
      // start_time/end_time come back from Sequelize as Date objects, but downstream
      // logic (toBusinessLocalDayBoundsUtc, parseTimestampWithOffset) expects ISO
      // strings with an explicit offset, same as the client-supplied values everywhere
      // else these methods are called from.
      const startISO = booking.start_time.toISOString();
      const endISO = booking.end_time.toISOString();

      const candidateIds = (await this._buildCandidateOrder(workerId, startISO, endISO, { transaction })).filter(
        (candidateId) => candidateId !== workerId
      );

      let newWorkerId = null;
      for (const candidateId of candidateIds) {
        const free = await this.bookingAvailabilityService.isWorkerFree(candidateId, startISO, endISO, {
          transaction,
          excludeId: booking.id,
        });
        if (free) {
          newWorkerId = candidateId;
          break;
        }
      }

      if (!newWorkerId) {
        throw new ConflictError(`Cannot deactivate worker: booking ${booking.id} has no available replacement worker`, {
          code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
        });
      }

      await this.bookingRepository.update({ id: booking.id }, { worker_id: newWorkerId }, { transaction });
      reassignments.push({ booking_id: booking.id, new_worker_id: newWorkerId });
    }

    return reassignments;
  }

  /**
   * Tries each candidate worker in order, each inside its OWN transaction (not one
   * shared transaction for the whole loop) — this is what lets the DB EXCLUDE
   * constraint act as the real per-candidate concurrency backstop. `attempt` throws
   * SKIP_CANDIDATE (pre-check found a conflict) or an exclusion-constraint error
   * (lost a race) to move to the next candidate; any other error propagates.
   */
  async _tryCandidates(candidateIds, attempt) {
    for (const candidateId of candidateIds) {
      try {
        return await sequelize.transaction((transaction) => attempt(candidateId, transaction));
      } catch (err) {
        if (err === SKIP_CANDIDATE || isExclusionConstraintError(err)) continue;
        throw err;
      }
    }
    return null;
  }
}
