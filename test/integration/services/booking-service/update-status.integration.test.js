import { describe, it, expect, afterEach } from '@jest/globals';
import { nextTuesdayAt } from '#test/helpers/future-dates.js';

const { BookingRepository } = await import('#repositories/booking.repository');
const { WorkerRepository } = await import('#repositories/worker.repository');
const { BookingService } = await import('#services/booking.service');
const { Worker } = await import('#models/worker.model');
const { Booking } = await import('#models/booking.model');

/**
 * Real committed rows (not seedWithTransaction's rollback pattern) — same reasoning as
 * cancel-booking.integration.test.js: updateStatus opens its own internal
 * sequelize.transaction() and doesn't accept an external one, so a row seeded inside an
 * uncommitted outer transaction wouldn't be visible to it. Cleaned up directly via
 * Booking.destroy()/Worker.destroy() in afterEach.
 *
 * The point of this file specifically is the COMPLETED transition: it wraps two writes
 * (the booking's status flip and workerRepository.incrementTotalHours) in one
 * transaction, and nothing elsewhere proves against real Postgres that both actually
 * land together.
 */
describe('BookingService.updateStatus (integration)', () => {
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

  it('transitioning to COMPLETED atomically persists the status and increments the worker\'s total_hours', async () => {
    const worker = await Worker.create({ name: 'Completion Test Worker', is_active: true, total_hours: 0 });
    workerIds.push(worker.id);

    // 09:00-10:30 local = 1.5 hours, an exact binary-float value so the assertion below
    // needs no epsilon tolerance.
    const booking = await Booking.create({
      worker_id: worker.id,
      customer_id: 1,
      start_time: nextTuesdayAt(9, 0),
      end_time: nextTuesdayAt(10, 30),
      status: 'CONFIRMED',
    });
    bookingIds.push(booking.id);

    const bookingService = buildService();
    const result = await bookingService.updateStatus(booking.id, 'COMPLETED');

    expect(result.status).toBe('COMPLETED');

    // Independent re-reads, not trusting what the service call returned, to prove both
    // writes genuinely committed together.
    const persistedBooking = await Booking.findByPk(booking.id);
    expect(persistedBooking.status).toBe('COMPLETED');

    const persistedWorker = await Worker.findByPk(worker.id);
    expect(persistedWorker.total_hours).toBe(1.5);
  });

  it('does not touch total_hours when transitioning to a non-COMPLETED status', async () => {
    const worker = await Worker.create({ name: 'Non-Completion Test Worker', is_active: true, total_hours: 0 });
    workerIds.push(worker.id);

    const booking = await Booking.create({
      worker_id: worker.id,
      customer_id: 1,
      start_time: nextTuesdayAt(11, 0),
      end_time: nextTuesdayAt(12, 0),
      status: 'PENDING',
    });
    bookingIds.push(booking.id);

    const bookingService = buildService();
    const result = await bookingService.updateStatus(booking.id, 'CONFIRMED');

    expect(result.status).toBe('CONFIRMED');

    const persistedBooking = await Booking.findByPk(booking.id);
    expect(persistedBooking.status).toBe('CONFIRMED');

    const persistedWorker = await Worker.findByPk(worker.id);
    expect(persistedWorker.total_hours).toBe(0);
  });
});
