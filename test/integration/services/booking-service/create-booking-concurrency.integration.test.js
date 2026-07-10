import { describe, it, expect, afterEach } from '@jest/globals';

const { BookingRepository } = await import('#repositories/booking.repository');
const { WorkerRepository } = await import('#repositories/worker.repository');
const { HolidayRepository } = await import('#repositories/holiday.repository');
const { BookingAvailabilityService } = await import('#services/booking-availability.service');
const { BookingService } = await import('#services/booking.service');
const { Worker } = await import('#models/worker.model');
const { Booking } = await import('#models/booking.model');
const { ConflictError } = await import('#configs/error');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');

/**
 * A genuine Postgres-level race: two independent, actually-committing transactions
 * (not the shared seedWithTransaction rollback pattern used elsewhere, which would
 * defeat the point — two operations inside one open transaction never contend on
 * Postgres's exclusion-constraint locking the way two independent transactions do).
 * Only ONE active worker is seeded in this test's scope so the auto-reassignment
 * fallback can't mask the race by silently succeeding against a different worker.
 */
describe('BookingService.createBooking concurrency (integration)', () => {
  let workerId;
  let bookingIdsToClean = [];

  afterEach(async () => {
    if (bookingIdsToClean.length) {
      await Booking.destroy({ where: { id: bookingIdsToClean } });
      bookingIdsToClean = [];
    }
    if (workerId) {
      await Worker.destroy({ where: { id: workerId } });
      workerId = undefined;
    }
  });

  it('lets exactly one of two overlapping concurrent bookings for the same worker succeed', async () => {
    const worker = await Worker.create({ name: 'Concurrency Test Worker', is_active: true });
    workerId = worker.id;

    const bookingRepository = new BookingRepository();
    const workerRepository = new WorkerRepository();
    const holidayRepository = new HolidayRepository();

    const bookingAvailabilityService = Object.create(BookingAvailabilityService.prototype);
    bookingAvailabilityService.holidayRepository = holidayRepository;
    bookingAvailabilityService.bookingRepository = bookingRepository;

    const bookingService = Object.create(BookingService.prototype);
    bookingService.bookingRepository = bookingRepository;
    bookingService.workerRepository = workerRepository;
    bookingService.bookingAvailabilityService = bookingAvailabilityService;

    // Tuesday 2026-07-14, 09:00-09:30 Asia/Ho_Chi_Minh — valid business-hours weekday slot.
    const payload = {
      worker_id: workerId,
      customer_id: 1,
      start_time: '2026-07-14T09:00:00+07:00',
      end_time: '2026-07-14T09:30:00+07:00',
    };

    const results = await Promise.allSettled([
      bookingService.createBooking(payload),
      bookingService.createBooking({ ...payload, customer_id: 2 }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictError);
    expect(rejected[0].reason.code).toBe(BOOKING_ERROR_CODES.WORKER_UNAVAILABLE);

    bookingIdsToClean.push(fulfilled[0].value.id);
  }, 15000);
});
