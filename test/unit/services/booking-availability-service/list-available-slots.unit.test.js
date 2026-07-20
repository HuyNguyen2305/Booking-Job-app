import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { nextTuesdayDate, nextSaturdayDate } from '#test/helpers/future-dates.js';

process.env.BUSINESS_TZ = 'Asia/Ho_Chi_Minh';

const holidayRepositoryMock = { existsOnLocalDate: jest.fn() };
const bookingRepositoryMock = { listOccupiedInWindow: jest.fn() };
const workerRepositoryMock = { listActive: jest.fn() };

const { BookingAvailabilityService } = await import('#services/booking-availability.service');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');
const { ValidationError } = await import('#configs/error');

describe('BookingAvailabilityService.listAvailableSlots', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    holidayRepositoryMock.existsOnLocalDate.mockResolvedValue(false);
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    bookingRepositoryMock.listOccupiedInWindow.mockResolvedValue([]);
    service = Object.create(BookingAvailabilityService.prototype);
    service.holidayRepository = holidayRepositoryMock;
    service.bookingRepository = bookingRepositoryMock;
    service.workerRepository = workerRepositoryMock;
  });

  it('throws ValidationError with INVALID_TIMESTAMP_FORMAT for a malformed date', async () => {
    await expect(service.listAvailableSlots('not-a-date')).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.INVALID_TIMESTAMP_FORMAT,
    });
    await expect(service.listAvailableSlots('not-a-date')).rejects.toBeInstanceOf(ValidationError);
  });

  it('returns [] for a Saturday without querying workers or bookings', async () => {
    const result = await service.listAvailableSlots(nextSaturdayDate());

    expect(result).toEqual([]);
    expect(workerRepositoryMock.listActive).not.toHaveBeenCalled();
    expect(bookingRepositoryMock.listOccupiedInWindow).not.toHaveBeenCalled();
  });

  it('returns [] for a holiday without querying workers or bookings', async () => {
    holidayRepositoryMock.existsOnLocalDate.mockResolvedValue(true);

    const result = await service.listAvailableSlots(nextTuesdayDate());

    expect(result).toEqual([]);
    expect(workerRepositoryMock.listActive).not.toHaveBeenCalled();
    expect(bookingRepositoryMock.listOccupiedInWindow).not.toHaveBeenCalled();
  });

  it('returns the full 09:00-17:00 business-local window as one slot when no worker has any booking', async () => {
    const date = nextTuesdayDate();

    const result = await service.listAvailableSlots(date);

    expect(result).toHaveLength(1);
    expect(result[0].start_time).toContain(`${date}T02:00:00`); // 09:00 +07:00 == 02:00 UTC
    expect(result[0].end_time).toContain(`${date}T10:00:00`); // 17:00 +07:00 == 10:00 UTC
  });

  it('queries occupied bookings for exactly the active worker ids over the business-hours window', async () => {
    const date = nextTuesdayDate();

    await service.listAvailableSlots(date);

    expect(bookingRepositoryMock.listOccupiedInWindow).toHaveBeenCalledWith(
      [1, 2],
      new Date(`${date}T02:00:00.000Z`),
      new Date(`${date}T10:00:00.000Z`)
    );
  });

  it('excludes a window where every active worker is booked simultaneously', async () => {
    const date = nextTuesdayDate();
    bookingRepositoryMock.listOccupiedInWindow.mockResolvedValue([
      { worker_id: 1, start_time: new Date(`${date}T02:00:00.000Z`), end_time: new Date(`${date}T10:00:00.000Z`) },
      { worker_id: 2, start_time: new Date(`${date}T02:00:00.000Z`), end_time: new Date(`${date}T10:00:00.000Z`) },
    ]);

    const result = await service.listAvailableSlots(date);

    expect(result).toEqual([]);
  });

  it('passes duration_minutes through to filter out slots shorter than requested', async () => {
    const date = nextTuesdayDate();
    // Only a 10-minute gap is free (09:00-09:10) before both workers become booked for the rest of the day.
    bookingRepositoryMock.listOccupiedInWindow.mockResolvedValue([
      { worker_id: 1, start_time: new Date(`${date}T02:10:00.000Z`), end_time: new Date(`${date}T10:00:00.000Z`) },
      { worker_id: 2, start_time: new Date(`${date}T02:10:00.000Z`), end_time: new Date(`${date}T10:00:00.000Z`) },
    ]);

    const result = await service.listAvailableSlots(date, { duration_minutes: 30 });

    expect(result).toEqual([]);
  });

  it('defaults duration_minutes to MIN_BOOKING_DURATION_MINUTES when not supplied', async () => {
    const date = nextTuesdayDate();
    bookingRepositoryMock.listOccupiedInWindow.mockResolvedValue([
      { worker_id: 1, start_time: new Date(`${date}T02:15:00.000Z`), end_time: new Date(`${date}T10:00:00.000Z`) },
      { worker_id: 2, start_time: new Date(`${date}T02:15:00.000Z`), end_time: new Date(`${date}T10:00:00.000Z`) },
    ]);

    // Free gap is 09:00-09:15 (15 min) — shorter than the 30-minute default, so filtered out.
    const result = await service.listAvailableSlots(date);

    expect(result).toEqual([]);
  });

  it('returns one window per weekday across a multi-day range, skipping the weekend', async () => {
    // Tuesday + 6 days = Tue, Wed, Thu, Fri, Sat, Sun, next Mon — only the 5 weekdays count.
    const date = nextTuesdayDate();

    const result = await service.listAvailableSlots(date, { days: 7 });

    expect(result).toHaveLength(5);
    // No window ever spans across days.
    for (const { start_time, end_time } of result) {
      expect(start_time.slice(0, 10)).toBe(end_time.slice(0, 10));
    }
  });

  it('queries occupied bookings once for the whole range, bounded by the first and last valid day', async () => {
    const date = nextTuesdayDate();

    await service.listAvailableSlots(date, { days: 4 }); // Tue-Fri, all weekdays

    expect(bookingRepositoryMock.listOccupiedInWindow).toHaveBeenCalledTimes(1);
    const [, rangeStart, rangeEnd] = bookingRepositoryMock.listOccupiedInWindow.mock.calls[0];
    expect(rangeStart).toEqual(new Date(`${date}T02:00:00.000Z`));
    expect(rangeEnd.getUTCDate()).toBeGreaterThan(rangeStart.getUTCDate());
  });

  it("a booking on one day does not affect another day's availability", async () => {
    const date = nextTuesdayDate();
    // Both workers fully booked on day 1 only.
    bookingRepositoryMock.listOccupiedInWindow.mockResolvedValue([
      { worker_id: 1, start_time: new Date(`${date}T02:00:00.000Z`), end_time: new Date(`${date}T10:00:00.000Z`) },
      { worker_id: 2, start_time: new Date(`${date}T02:00:00.000Z`), end_time: new Date(`${date}T10:00:00.000Z`) },
    ]);

    const result = await service.listAvailableSlots(date, { days: 2 }); // Tue (fully booked), Wed (free)

    expect(result).toHaveLength(1);
    expect(result[0].start_time).not.toContain(date);
  });
});
