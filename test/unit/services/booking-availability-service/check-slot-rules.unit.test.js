import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { DateTime } from 'luxon';
import { nextTuesdayAt, nextSaturdayAt } from '#test/helpers/future-dates.js';

process.env.BUSINESS_TZ = 'Asia/Ho_Chi_Minh';

const holidayRepositoryMock = { existsOnLocalDate: jest.fn() };
const bookingRepositoryMock = { findOverlappingForWorker: jest.fn() };

const { BookingAvailabilityService } = await import('#services/booking-availability.service');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');
const { ValidationError } = await import('#configs/error');

describe('BookingAvailabilityService.checkSlotRules', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    holidayRepositoryMock.existsOnLocalDate.mockResolvedValue(false);
    service = Object.create(BookingAvailabilityService.prototype);
    service.holidayRepository = holidayRepositoryMock;
    service.bookingRepository = bookingRepositoryMock;
  });

  it('rejects a start time that has already passed with PAST_BOOKING_TIME', async () => {
    // Relative to the real clock (not a hardcoded date) so this stays correct forever.
    const pastStart = DateTime.now().minus({ days: 7 }).toISO();
    const pastEnd = DateTime.now().minus({ days: 7 }).plus({ minutes: 30 }).toISO();

    const result = await service.checkSlotRules(pastStart, pastEnd);
    expect(result).toEqual({ ok: false, code: BOOKING_ERROR_CODES.PAST_BOOKING_TIME });
  });

  it('checks PAST_BOOKING_TIME before other slot rules', async () => {
    // A past instant that also happens to be a weekend/off-hours must still surface
    // PAST_BOOKING_TIME, not NON_WEEKDAY_BOOKING/OUTSIDE_BUSINESS_HOURS.
    const pastMidnight = DateTime.now().minus({ days: 30 }).set({ hour: 0, minute: 0 }).toISO();
    const pastMidnightEnd = DateTime.now().minus({ days: 30 }).set({ hour: 0, minute: 30 }).toISO();

    const result = await service.checkSlotRules(pastMidnight, pastMidnightEnd);
    expect(result).toEqual({ ok: false, code: BOOKING_ERROR_CODES.PAST_BOOKING_TIME });
  });

  it('rejects a start time before 09:00 local with OUTSIDE_BUSINESS_HOURS', async () => {
    const result = await service.checkSlotRules(nextTuesdayAt(8, 59), nextTuesdayAt(9, 29));
    expect(result).toEqual({ ok: false, code: BOOKING_ERROR_CODES.OUTSIDE_BUSINESS_HOURS });
  });

  it('rejects an end time after 17:00 local with OUTSIDE_BUSINESS_HOURS', async () => {
    const result = await service.checkSlotRules(nextTuesdayAt(16, 45), nextTuesdayAt(17, 15));
    expect(result).toEqual({ ok: false, code: BOOKING_ERROR_CODES.OUTSIDE_BUSINESS_HOURS });
  });

  it('rejects a Saturday booking with NON_WEEKDAY_BOOKING', async () => {
    const result = await service.checkSlotRules(nextSaturdayAt(10, 0), nextSaturdayAt(10, 30));
    expect(result).toEqual({ ok: false, code: BOOKING_ERROR_CODES.NON_WEEKDAY_BOOKING });
  });

  it('rejects a date present in the holidays table with HOLIDAY_CLOSURE', async () => {
    holidayRepositoryMock.existsOnLocalDate.mockResolvedValue(true);
    const start = nextTuesdayAt(10, 0);
    const end = nextTuesdayAt(10, 30);
    const expectedDate = DateTime.fromISO(start).toISODate();

    const result = await service.checkSlotRules(start, end);
    expect(result).toEqual({ ok: false, code: BOOKING_ERROR_CODES.HOLIDAY_CLOSURE });
    expect(holidayRepositoryMock.existsOnLocalDate).toHaveBeenCalledWith(expectedDate, { transaction: undefined });
  });

  it('returns ok:true for a weekday, in-hours, non-holiday slot', async () => {
    const result = await service.checkSlotRules(nextTuesdayAt(10, 0), nextTuesdayAt(10, 30));
    expect(result).toEqual({ ok: true });
  });

  it('throws ValidationError with INVALID_TIMESTAMP_FORMAT when start_time has no UTC offset', async () => {
    await expect(service.checkSlotRules('2026-07-14T10:00:00', nextTuesdayAt(10, 30))).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.INVALID_TIMESTAMP_FORMAT,
    });
    await expect(service.checkSlotRules('2026-07-14T10:00:00', nextTuesdayAt(10, 30))).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('throws ValidationError with INVALID_TIMESTAMP_FORMAT when end_time has no UTC offset', async () => {
    await expect(service.checkSlotRules(nextTuesdayAt(10, 0), '2026-07-14T10:30:00')).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.INVALID_TIMESTAMP_FORMAT,
    });
  });
});
