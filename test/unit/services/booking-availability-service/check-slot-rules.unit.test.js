import { jest, describe, it, expect, beforeEach } from '@jest/globals';

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

  it('rejects a start time before 09:00 local with OUTSIDE_BUSINESS_HOURS', async () => {
    const result = await service.checkSlotRules('2026-07-14T08:59:00+07:00', '2026-07-14T09:29:00+07:00');
    expect(result).toEqual({ ok: false, code: BOOKING_ERROR_CODES.OUTSIDE_BUSINESS_HOURS });
  });

  it('rejects an end time after 17:00 local with OUTSIDE_BUSINESS_HOURS', async () => {
    const result = await service.checkSlotRules('2026-07-14T16:45:00+07:00', '2026-07-14T17:15:00+07:00');
    expect(result).toEqual({ ok: false, code: BOOKING_ERROR_CODES.OUTSIDE_BUSINESS_HOURS });
  });

  it('rejects a Saturday booking with NON_WEEKDAY_BOOKING', async () => {
    const result = await service.checkSlotRules('2026-07-18T10:00:00+07:00', '2026-07-18T10:30:00+07:00');
    expect(result).toEqual({ ok: false, code: BOOKING_ERROR_CODES.NON_WEEKDAY_BOOKING });
  });

  it('rejects a date present in the holidays table with HOLIDAY_CLOSURE', async () => {
    holidayRepositoryMock.existsOnLocalDate.mockResolvedValue(true);
    const result = await service.checkSlotRules('2026-07-14T10:00:00+07:00', '2026-07-14T10:30:00+07:00');
    expect(result).toEqual({ ok: false, code: BOOKING_ERROR_CODES.HOLIDAY_CLOSURE });
    expect(holidayRepositoryMock.existsOnLocalDate).toHaveBeenCalledWith('2026-07-14', { transaction: undefined });
  });

  it('returns ok:true for a weekday, in-hours, non-holiday slot', async () => {
    const result = await service.checkSlotRules('2026-07-14T10:00:00+07:00', '2026-07-14T10:30:00+07:00');
    expect(result).toEqual({ ok: true });
  });

  it('throws ValidationError with INVALID_TIMESTAMP_FORMAT when start_time has no UTC offset', async () => {
    await expect(service.checkSlotRules('2026-07-14T10:00:00', '2026-07-14T10:30:00+07:00')).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.INVALID_TIMESTAMP_FORMAT,
    });
    await expect(service.checkSlotRules('2026-07-14T10:00:00', '2026-07-14T10:30:00+07:00')).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('throws ValidationError with INVALID_TIMESTAMP_FORMAT when end_time has no UTC offset', async () => {
    await expect(service.checkSlotRules('2026-07-14T10:00:00+07:00', '2026-07-14T10:30:00')).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.INVALID_TIMESTAMP_FORMAT,
    });
  });
});
