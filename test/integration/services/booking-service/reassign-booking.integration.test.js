import { describe, it, expect, afterEach } from '@jest/globals';
import { Op } from 'sequelize';

const { BookingRepository } = await import('#repositories/booking.repository');
const { WorkerRepository } = await import('#repositories/worker.repository');
const { HolidayRepository } = await import('#repositories/holiday.repository');
const { BookingAvailabilityService } = await import('#services/booking-availability.service');
const { BookingService } = await import('#services/booking.service');
const { Worker } = await import('#models/worker.model');
const { Booking } = await import('#models/booking.model');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');
const { isExclusionConstraintError } = await import('#utils/sequelize-error.util');

/**
 * Real committed transactions, not the shared seedWithTransaction rollback pattern —
 * same reasoning as the concurrency test and the deactivation-flow integration test:
 * this dev DB may have real leftover active workers from manual testing, so any test
 * that needs a specific worker to win (or nobody to win) explicitly blocks every other
 * currently-active worker for its slot first.
 */
describe('BookingService.reassignBooking (integration)', () => {
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

    return bookingService;
  }

  async function blockOtherActiveWorkers(excludeIds, slot) {
    const others = await Worker.findAll({ where: { is_active: true, id: { [Op.notIn]: excludeIds } } });
    for (const worker of others) {
      try {
        const blocker = await Booking.create({ worker_id: worker.id, customer_id: 999, ...slot, status: 'CONFIRMED' });
        bookingIds.push(blocker.id);
      } catch (err) {
        if (!isExclusionConstraintError(err)) throw err;
      }
    }
  }

  it('moves the booking to another free active worker without changing its time', async () => {
    const workerA = await Worker.create({ name: 'Current Worker', is_active: true });
    const workerB = await Worker.create({ name: 'Free Worker', is_active: true });
    workerIds.push(workerA.id, workerB.id);

    const slot = { start_time: '2026-07-14T14:36:00+07:00', end_time: '2026-07-14T15:02:00+07:00' };
    await blockOtherActiveWorkers([workerA.id, workerB.id], slot);

    const booking = await Booking.create({ worker_id: workerA.id, customer_id: 1, ...slot, status: 'PENDING' });
    bookingIds.push(booking.id);

    const bookingService = buildService();
    const result = await bookingService.reassignBooking(booking.id);

    expect(result.worker_id).toBe(workerB.id);
    expect(result.reassigned).toBe(true);
    expect(result.requested_worker_id).toBe(workerA.id);
    expect(new Date(result.start_time).toISOString()).toBe(new Date(slot.start_time).toISOString());

    const updatedBooking = await Booking.findByPk(booking.id);
    expect(updatedBooking.worker_id).toBe(workerB.id);
  }, 15000);

  it('throws WORKER_UNAVAILABLE and leaves the booking untouched when no other worker is free', async () => {
    const workerA = await Worker.create({ name: 'Only Worker', is_active: true });
    workerIds.push(workerA.id);

    const slot = { start_time: '2026-07-14T16:11:00+07:00', end_time: '2026-07-14T16:40:00+07:00' };
    await blockOtherActiveWorkers([workerA.id], slot);

    const booking = await Booking.create({ worker_id: workerA.id, customer_id: 1, ...slot, status: 'CONFIRMED' });
    bookingIds.push(booking.id);

    const bookingService = buildService();

    await expect(bookingService.reassignBooking(booking.id)).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
    });

    const untouchedBooking = await Booking.findByPk(booking.id);
    expect(untouchedBooking.worker_id).toBe(workerA.id);
    expect(untouchedBooking.status).toBe('CONFIRMED');
  }, 15000);

  it('succeeds after a blocker is cancelled, freeing that worker up', async () => {
    const workerA = await Worker.create({ name: 'Current Worker 2', is_active: true });
    const workerB = await Worker.create({ name: 'Newly Free Worker', is_active: true });
    workerIds.push(workerA.id, workerB.id);

    const slot = { start_time: '2026-07-14T16:05:00+07:00', end_time: '2026-07-14T16:33:00+07:00' };
    await blockOtherActiveWorkers([workerA.id, workerB.id], slot);

    const booking = await Booking.create({ worker_id: workerA.id, customer_id: 1, ...slot, status: 'PENDING' });
    bookingIds.push(booking.id);

    const blockerOnB = await Booking.create({ worker_id: workerB.id, customer_id: 2, ...slot, status: 'CONFIRMED' });
    bookingIds.push(blockerOnB.id);

    const bookingService = buildService();

    // With B still blocked, there's no one to reassign to.
    await expect(bookingService.reassignBooking(booking.id)).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
    });

    // Cancelling the blocker frees B up — this is the scenario the endpoint exists for.
    await blockerOnB.update({ status: 'CANCELLED' });

    const result = await bookingService.reassignBooking(booking.id);
    expect(result.worker_id).toBe(workerB.id);
  }, 15000);
});
