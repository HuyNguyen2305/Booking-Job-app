import { DateTime } from 'luxon';
import { REPOSITORY_KEYS, SERVICE_KEYS } from '#constants/singleton';
import { ValidationError, NotFoundError } from '#configs/error';
import { BOOKING_ERROR_CODES } from '#constants/error-codes.const';
import { BUSINESS_TZ, WEEKLY_HOURS_CAP } from '#constants/business-hours.const';
import { parseTimestampWithOffset, toBusinessLocalDayBoundsUtc, toBusinessLocalWeekBoundsUtc } from '#utils/date.util';
import { rankAvailableWorkers } from '#utils/worker-availability.util';
import { sequelize } from '#models/index';

export class WorkerService {
  constructor({ container }) {
    this.workerRepository = container.resolve(REPOSITORY_KEYS.WORKER);
    this.bookingService = container.resolve(SERVICE_KEYS.BOOKING);
  }

  async listAvailable({ start, end }) {
    if (!parseTimestampWithOffset(start) || !parseTimestampWithOffset(end)) {
      throw new ValidationError('start/end must be ISO 8601 date-times with an explicit UTC offset', {
        code: BOOKING_ERROR_CODES.INVALID_TIMESTAMP_FORMAT,
      });
    }

    const activeWorkers = await this.workerRepository.listActive();
    const workerIds = activeWorkers.map((worker) => worker.id);
    const { dayStart, dayEnd } = toBusinessLocalDayBoundsUtc(start, BUSINESS_TZ);
    const rows = await this.workerRepository.getAvailability(workerIds, {
      start,
      end,
      windowStart: dayStart,
      windowEnd: dayEnd,
    });
    return rankAvailableWorkers(rows);
  }

  async register({ name }) {
    return this.workerRepository.create({ name });
  }

  async list() {
    return this.workerRepository.get({ order: [['id', 'ASC']] });
  }

  /**
   * Worker identity plus a performance snapshot: hours worked (COMPLETED only) this
   * business-local week against the WEEKLY_HOURS_CAP (computed live — bounded to
   * ~a week of rows), and all-time total hours (read straight off `workers.total_hours`,
   * a running total maintained by `BookingService.updateStatus` on each COMPLETED
   * transition, rather than re-summed from the worker's entire booking history here).
   */
  async getById(id) {
    const worker = await this.workerRepository.getOne({ where: { id } });
    if (!worker) {
      throw new NotFoundError('Worker not found');
    }

    const { weekStart, weekEnd } = toBusinessLocalWeekBoundsUtc(DateTime.now().setZone(BUSINESS_TZ).toISO(), BUSINESS_TZ);
    const hours_this_week = await this.workerRepository.getHoursThisWeek(id, { weekStart, weekEnd });

    return { ...worker.toJSON(), hours_this_week, weekly_hours_cap: WEEKLY_HOURS_CAP };
  }

  /**
   * Reactivating a worker is a plain flag flip. Deactivating one first tries to move
   * every still-open, not-yet-started booking of theirs onto another active worker;
   * if any single one has no available replacement, the whole thing is rolled back and
   * the worker stays active — a worker can only actually go inactive once every booking
   * that needs one is either resolved (COMPLETED/CANCELLED) or safely reassigned.
   */
  async updateStatus(id, is_active) {
    const worker = await this.workerRepository.getOne({ where: { id } });
    if (!worker) {
      throw new NotFoundError('Worker not found');
    }

    if (is_active) {
      return this.workerRepository.update({ id }, { is_active: true });
    }

    return sequelize.transaction(async (transaction) => {
      const reassignedBookings = await this.bookingService.reassignBookingsFromWorker(id, { transaction });
      const updated = await this.workerRepository.update({ id }, { is_active: false }, { transaction });
      return { ...updated.toJSON(), reassigned_bookings: reassignedBookings };
    });
  }
}
