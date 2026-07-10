import { REPOSITORY_KEYS } from '#constants/singleton';
import { ValidationError } from '#configs/error';
import { BOOKING_ERROR_CODES } from '#constants/error-codes.const';
import { BUSINESS_TZ, WORK_START_HOUR, WORK_END_HOUR } from '#constants/business-hours.const';
import { parseTimestampWithOffset } from '#utils/date.util';

export class BookingAvailabilityService {
  constructor({ container }) {
    this.holidayRepository = container.resolve(REPOSITORY_KEYS.HOLIDAY);
    this.bookingRepository = container.resolve(REPOSITORY_KEYS.BOOKING);
  }

  _parse(value, label) {
    const dt = parseTimestampWithOffset(value);
    if (!dt) {
      throw new ValidationError(
        `${label} must be an ISO 8601 date-time with an explicit UTC offset (e.g. "2026-07-10T09:00:00Z")`,
        { code: BOOKING_ERROR_CODES.INVALID_TIMESTAMP_FORMAT }
      );
    }
    return dt;
  }

  /**
   * Worker-independent checks: timestamp format, weekday, business hours, holiday.
   * Called once per booking attempt regardless of how many candidate workers get tried.
   */
  async checkSlotRules(startISO, endISO, { transaction } = {}) {
    const startLocal = this._parse(startISO, 'start_time').setZone(BUSINESS_TZ);
    const endLocal = this._parse(endISO, 'end_time').setZone(BUSINESS_TZ);

    if (startLocal.weekday > 5) {
      return { ok: false, code: BOOKING_ERROR_CODES.NON_WEEKDAY_BOOKING };
    }

    const dayStart = startLocal.set({ hour: WORK_START_HOUR, minute: 0, second: 0, millisecond: 0 });
    const dayEnd = startLocal.set({ hour: WORK_END_HOUR, minute: 0, second: 0, millisecond: 0 });
    // luxon DateTime implements valueOf(), so relational operators compare instants correctly.
    const withinHours = startLocal.hasSame(endLocal, 'day') && startLocal >= dayStart && endLocal <= dayEnd;
    if (!withinHours) {
      return { ok: false, code: BOOKING_ERROR_CODES.OUTSIDE_BUSINESS_HOURS };
    }

    const isHoliday = await this.holidayRepository.existsOnLocalDate(startLocal.toISODate(), { transaction });
    if (isHoliday) {
      return { ok: false, code: BOOKING_ERROR_CODES.HOLIDAY_CLOSURE };
    }

    return { ok: true };
  }

  /** Whether `workerId` has no active booking overlapping [startISO, endISO). */
  async isWorkerFree(workerId, startISO, endISO, { transaction, excludeId } = {}) {
    const overlap = await this.bookingRepository.findOverlappingForWorker(workerId, startISO, endISO, {
      excludeId,
      transaction,
    });
    return !overlap;
  }
}
