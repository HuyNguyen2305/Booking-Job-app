import { describe, it, expect, afterEach } from '@jest/globals';
import { Op } from 'sequelize';

const { BookingRepository } = await import('#repositories/booking.repository');
const { WorkerRepository } = await import('#repositories/worker.repository');
const { HolidayRepository } = await import('#repositories/holiday.repository');
const { BookingAvailabilityService } = await import('#services/booking-availability.service');
const { BookingService } = await import('#services/booking.service');
const { WorkerService } = await import('#services/worker.service');
const { Worker } = await import('#models/worker.model');
const { Booking } = await import('#models/booking.model');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');
const { isExclusionConstraintError } = await import('#utils/sequelize-error.util');

/**
 * Real committed transactions (not the shared seedWithTransaction rollback pattern) —
 * the point of this test is proving WorkerService.updateStatus's internal
 * sequelize.transaction() genuinely rolls back ALL reassignments (not just some) when
 * even one booking can't be moved, which a shared outer transaction would mask.
 *
 * This dev DB may already have real, leftover active workers from manual/Swagger
 * testing (seen repeatedly in this project), so tests here can never assume "no other
 * active worker exists" or "worker B is the only free candidate" for free — every test
 * that needs a specific outcome explicitly blocks every OTHER currently-active worker
 * for its slot first, the same lesson learned from the earlier concurrency test.
 */
describe('WorkerService.updateStatus deactivation flow (integration)', () => {
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

  function buildServices() {
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

    const workerService = Object.create(WorkerService.prototype);
    workerService.workerRepository = workerRepository;
    workerService.bookingService = bookingService;

    return { workerService };
  }

  /**
   * Occupies every currently-active worker except `excludeIds` for `slot`, so none of
   * them can be offered as a replacement. If a worker already has a conflicting booking
   * at that slot (real leftover data), the EXCLUDE constraint rejects our insert — that's
   * fine, it means they're already blocked, so we just skip them instead of failing.
   */
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

  it('reassigns open future bookings to another active worker and deactivates', async () => {
    const workerA = await Worker.create({ name: 'Deactivate Me', is_active: true });
    const workerB = await Worker.create({ name: 'Backup Worker', is_active: true });
    workerIds.push(workerA.id, workerB.id);

    const slot = { start_time: '2026-07-14T09:41:00+07:00', end_time: '2026-07-14T10:07:00+07:00' };
    await blockOtherActiveWorkers([workerA.id, workerB.id], slot);

    const booking = await Booking.create({ worker_id: workerA.id, customer_id: 1, ...slot, status: 'PENDING' });
    bookingIds.push(booking.id);

    const { workerService } = buildServices();
    const result = await workerService.updateStatus(workerA.id, false);

    expect(result.is_active).toBe(false);
    expect(result.reassigned_bookings).toEqual([{ booking_id: booking.id, new_worker_id: workerB.id }]);

    const updatedWorkerA = await Worker.findByPk(workerA.id);
    expect(updatedWorkerA.is_active).toBe(false);

    const updatedBooking = await Booking.findByPk(booking.id);
    expect(updatedBooking.worker_id).toBe(workerB.id);
  }, 15000);

  it('rolls back everything — worker stays active, booking stays put — when no replacement is available', async () => {
    const workerA = await Worker.create({ name: 'Deactivate Me Alone', is_active: true });
    workerIds.push(workerA.id);

    const slot = { start_time: '2026-07-14T13:23:00+07:00', end_time: '2026-07-14T13:52:00+07:00' };
    await blockOtherActiveWorkers([workerA.id], slot);

    const booking = await Booking.create({ worker_id: workerA.id, customer_id: 1, ...slot, status: 'CONFIRMED' });
    bookingIds.push(booking.id);

    const { workerService } = buildServices();

    await expect(workerService.updateStatus(workerA.id, false)).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
    });

    const stillActiveWorker = await Worker.findByPk(workerA.id);
    expect(stillActiveWorker.is_active).toBe(true);

    const untouchedBooking = await Booking.findByPk(booking.id);
    expect(untouchedBooking.worker_id).toBe(workerA.id);
    expect(untouchedBooking.status).toBe('CONFIRMED');
  }, 15000);

  it('deactivates successfully when the only booking is already COMPLETED (nothing to reassign)', async () => {
    const workerA = await Worker.create({ name: 'Done For The Day', is_active: true });
    workerIds.push(workerA.id);

    const booking = await Booking.create({
      worker_id: workerA.id,
      customer_id: 1,
      start_time: '2026-07-14T09:00:00+07:00',
      end_time: '2026-07-14T09:30:00+07:00',
      status: 'COMPLETED',
    });
    bookingIds.push(booking.id);

    const { workerService } = buildServices();
    const result = await workerService.updateStatus(workerA.id, false);

    expect(result.is_active).toBe(false);
    expect(result.reassigned_bookings).toEqual([]);

    const untouchedBooking = await Booking.findByPk(booking.id);
    expect(untouchedBooking.worker_id).toBe(workerA.id);
  });
});
