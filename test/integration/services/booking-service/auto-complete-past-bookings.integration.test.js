import { describe, it, expect, afterEach } from '@jest/globals';
import { nextTuesdayAt } from '#test/helpers/future-dates.js';

const { BookingRepository } = await import('#repositories/booking.repository');
const { WorkerRepository } = await import('#repositories/worker.repository');
const { BookingService } = await import('#services/booking.service');
const { Worker } = await import('#models/worker.model');
const { Booking } = await import('#models/booking.model');

/**
 * Real committed rows (not seedWithTransaction's rollback pattern) — same reasoning as
 * update-status.integration.test.js: autoCompletePastBookings calls updateStatus per
 * booking, which opens its own internal sequelize.transaction() and doesn't accept an
 * external one.
 *
 * autoCompletePastBookings sweeps ALL past-due CONFIRMED bookings system-wide, not just
 * ones for a specific worker, so assertions here only check this test's own booking/worker
 * by id (via toContain, not toEqual on result.completed) — this dev DB may have other real
 * past-due CONFIRMED bookings left over from manual/Swagger testing, same caveat other
 * integration tests in this suite already account for.
 */
describe('BookingService.autoCompletePastBookings (integration)', () => {
  let workerIds = [];
  let bookingIds = [];

  afterEach(async () => {
    if (bookingIds.length) {
      await Booking.destroy({ where: { id: bookingIds } });
      bookingIds = [];
    }
    if (workerIds.length) {
      await Worker.destroy({ where: { id: workerIds } });
      workerIds = [];
    }
  });

  function buildService() {
    const bookingService = Object.create(BookingService.prototype);
    bookingService.bookingRepository = new BookingRepository();
    bookingService.workerRepository = new WorkerRepository();
    return bookingService;
  }

  it('completes a past-due CONFIRMED booking and adds its duration to the worker\'s total_hours', async () => {
    const worker = await Worker.create({ name: 'Auto Complete Test Worker', is_active: true, total_hours: 0 });
    workerIds.push(worker.id);

    // 2 hours, deliberately a fixed date far in the past (not relative to "now") so this
    // stays a valid past-due booking indefinitely — same reasoning as
    // list-past-confirmed.integration.test.js's fixed-past fixtures. 02:00-04:00 UTC =
    // 09:00-11:00 local (Asia/Ho_Chi_Minh, UTC+7) on a Monday, within business hours.
    const booking = await Booking.create({
      worker_id: worker.id,
      customer_id: 1,
      start_time: new Date('2020-01-06T02:00:00.000Z'),
      end_time: new Date('2020-01-06T04:00:00.000Z'),
      status: 'CONFIRMED',
    });
    bookingIds.push(booking.id);

    const bookingService = buildService();
    const result = await bookingService.autoCompletePastBookings();

    expect(result.completed).toContain(booking.id);
    expect(result.failed.find((f) => f.booking_id === booking.id)).toBeUndefined();

    const persistedBooking = await Booking.findByPk(booking.id);
    expect(persistedBooking.status).toBe('COMPLETED');

    const persistedWorker = await Worker.findByPk(worker.id);
    expect(persistedWorker.total_hours).toBe(2);
  });

  it('does not touch a CONFIRMED booking whose end_time has not passed yet', async () => {
    const worker = await Worker.create({ name: 'Future Booking Test Worker', is_active: true, total_hours: 0 });
    workerIds.push(worker.id);

    const booking = await Booking.create({
      worker_id: worker.id,
      customer_id: 1,
      start_time: nextTuesdayAt(9, 0),
      end_time: nextTuesdayAt(10, 0),
      status: 'CONFIRMED',
    });
    bookingIds.push(booking.id);

    const bookingService = buildService();
    const result = await bookingService.autoCompletePastBookings();

    expect(result.completed).not.toContain(booking.id);

    const persistedBooking = await Booking.findByPk(booking.id);
    expect(persistedBooking.status).toBe('CONFIRMED');
  });
});
