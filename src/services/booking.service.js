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
import { isAtLeastMinutesApart, toBusinessLocalDayBoundsUtc } from '#utils/date.util';
import { isExclusionConstraintError } from '#utils/sequelize-error.util';
import { rankAvailableWorkers } from '#utils/worker-availability.util';
import { sequelize } from '#models/index';

const SKIP_CANDIDATE = Symbol('SKIP_CANDIDATE');

const SLOT_RULE_MESSAGES = {
  [BOOKING_ERROR_CODES.NON_WEEKDAY_BOOKING]: 'Bookings can only be made on weekdays (Mon-Fri)',
  [BOOKING_ERROR_CODES.OUTSIDE_BUSINESS_HOURS]: 'Bookings must fall within business hours (09:00-17:00)',
  [BOOKING_ERROR_CODES.HOLIDAY_CLOSURE]: 'Bookings cannot be made on a company holiday',
};

export class BookingService {
  constructor({ container }) {
    this.bookingRepository = container.resolve(REPOSITORY_KEYS.BOOKING);
    this.workerRepository = container.resolve(REPOSITORY_KEYS.WORKER);
    this.bookingAvailabilityService = container.resolve(SERVICE_KEYS.BOOKING_AVAILABILITY);
  }

  async createBooking({ worker_id, customer_id, start_time, end_time }) {
    if (!isAtLeastMinutesApart(start_time, end_time, MIN_BOOKING_DURATION_MINUTES)) {
      throw new ValidationError(`end_time must be at least ${MIN_BOOKING_DURATION_MINUTES} minutes after start_time`);
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

    return this.bookingRepository.update({ id }, { status: nextStatus });
  }

  async listByWorker(workerId, { from, to } = {}) {
    return this.bookingRepository.listByWorker(workerId, { from, to });
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
   * [primaryWorkerId, ...other active workers with no overlap, ranked ascending by that
   * day's booked hours]. `primaryWorkerId` is only included if it's actually an active,
   * registered worker — a request for a nonexistent/inactive worker_id must not be
   * silently accepted just because no overlapping booking happens to exist for that id yet.
   */
  async _buildCandidateOrder(primaryWorkerId, startISO, endISO) {
    const activeWorkers = await this.workerRepository.listActive();
    const activeIds = activeWorkers.map((worker) => worker.id);
    const primaryIsActive = activeIds.includes(primaryWorkerId);
    const otherIds = activeIds.filter((id) => id !== primaryWorkerId);

    if (!otherIds.length) return primaryIsActive ? [primaryWorkerId] : [];

    const { dayStart, dayEnd } = toBusinessLocalDayBoundsUtc(startISO, BUSINESS_TZ);
    const rows = await this.workerRepository.getAvailability(otherIds, { start: startISO, end: endISO, dayStart, dayEnd });
    const ranked = rankAvailableWorkers(rows);
    const rankedIds = ranked.map((row) => row.worker_id);
    return primaryIsActive ? [primaryWorkerId, ...rankedIds] : rankedIds;
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
