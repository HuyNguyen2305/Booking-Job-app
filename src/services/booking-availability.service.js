import { DateTime } from 'luxon';
import { REPOSITORY_KEYS } from '#constants/singleton';
import { ValidationError } from '#configs/error';
import { BOOKING_ERROR_CODES } from '#constants/error-codes.const';
import { MIN_BOOKING_DURATION_MINUTES } from '#constants/booking-status.const';
import { BUSINESS_TZ, WORK_START_HOUR, WORK_END_HOUR } from '#constants/business-hours.const';
import { parseTimestampWithOffset } from '#utils/date.util';
import { computeAvailableSlots } from '#utils/availability-slots.util';

export class BookingAvailabilityService {
  constructor({ container }) {
    this.holidayRepository = container.resolve(REPOSITORY_KEYS.HOLIDAY);
    this.bookingRepository = container.resolve(REPOSITORY_KEYS.BOOKING);
    this.workerRepository = container.resolve(REPOSITORY_KEYS.WORKER);
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
   * Worker-independent checks: timestamp format, not-in-the-past, weekday, business
   * hours, holiday. Called once per booking attempt regardless of how many candidate
   * workers get tried.
   */
  async checkSlotRules(startISO, endISO, { transaction } = {}) {
    const startLocal = this._parse(startISO, 'start_time').setZone(BUSINESS_TZ);
    const endLocal = this._parse(endISO, 'end_time').setZone(BUSINESS_TZ);

    if (startLocal < DateTime.now()) {
      return { ok: false, code: BOOKING_ERROR_CODES.PAST_BOOKING_TIME };
    }

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

  /**
   * `dayLocal`'s business-hours window (09:00-17:00 business-local) as UTC Date bounds, or
   * null if the day isn't bookable at all: a weekend, a holiday, or (for "today") one whose
   * business hours have already fully passed. For today, the window starts at "now" rather
   * than 09:00, since earlier slots aren't bookable anyway.
   */
  async _businessDayWindow(dayLocal) {
    if (dayLocal.weekday > 5) return null;

    const isHoliday = await this.holidayRepository.existsOnLocalDate(dayLocal.toISODate());
    if (isHoliday) return null;

    const windowStartLocal = dayLocal.set({ hour: WORK_START_HOUR, minute: 0, second: 0, millisecond: 0 });
    const windowEndLocal = dayLocal.set({ hour: WORK_END_HOUR, minute: 0, second: 0, millisecond: 0 });
    const now = DateTime.now();
    const clippedStartLocal = windowStartLocal < now ? now : windowStartLocal;
    if (clippedStartLocal >= windowEndLocal) return null;

    return { windowStart: clippedStartLocal.toUTC().toJSDate(), windowEnd: windowEndLocal.toUTC().toJSDate() };
  }

  /**
   * Every window across the `days` business-local calendar days starting at `dateStr`
   * (default 1, i.e. just that one day) at least `duration_minutes` long where at least one
   * active worker has no occupied booking — i.e. where a booking of that duration could
   * actually be created, without the caller having to guess a start_time and get a 409 back.
   * Non-bookable days (weekend/holiday/fully-passed) contribute no windows rather than an
   * error — "no slots this day" is a normal outcome, not a validation failure. Windows never
   * span across days: business hours don't cover nights, so each day is swept independently
   * and the results concatenated, even though the occupied-bookings query itself is a single
   * call covering the whole range (cheaper than one query per day).
   */
  async listAvailableSlots(dateStr, { duration_minutes = MIN_BOOKING_DURATION_MINUTES, days = 1 } = {}) {
    const startLocal = DateTime.fromISO(dateStr, { zone: BUSINESS_TZ });
    if (!startLocal.isValid) {
      throw new ValidationError('date must be a valid ISO 8601 calendar date (e.g. "2026-07-21")', {
        code: BOOKING_ERROR_CODES.INVALID_TIMESTAMP_FORMAT,
      });
    }

    const dayWindows = [];
    for (let offset = 0; offset < days; offset += 1) {
      const window = await this._businessDayWindow(startLocal.plus({ days: offset }));
      if (window) dayWindows.push(window);
    }
    if (dayWindows.length === 0) return [];

    const activeWorkers = await this.workerRepository.listActive();
    const workerIds = activeWorkers.map((worker) => worker.id);
    const bookings = await this.bookingRepository.listOccupiedInWindow(
      workerIds,
      dayWindows[0].windowStart,
      dayWindows[dayWindows.length - 1].windowEnd
    );

    return dayWindows.flatMap(({ windowStart, windowEnd }) =>
      computeAvailableSlots({ windowStart, windowEnd, workerIds, bookings, minDurationMinutes: duration_minutes })
    );
  }
}
