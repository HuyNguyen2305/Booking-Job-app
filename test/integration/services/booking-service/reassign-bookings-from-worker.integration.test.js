import { describe, it, expect, afterEach, beforeAll } from '@jest/globals';
import { nextTuesdayAt } from '#test/helpers/future-dates.js';

const { BookingRepository } = await import('#repositories/booking.repository');
const { WorkerRepository } = await import('#repositories/worker.repository');
const { HolidayRepository } = await import('#repositories/holiday.repository');
const { BookingAvailabilityService } = await import('#services/booking-availability.service');
const { BookingService } = await import('#services/booking.service');
const { Worker } = await import('#models/worker.model');
const { Booking } = await import('#models/booking.model');
const { sequelize } = await import('#models/index');
const { isExclusionConstraintError } = await import('#utils/sequelize-error.util');

/**
 * This is the regression test for the bug fixed here: `reassignBookingsFromWorker` writes
 * a candidate's new worker_id straight to the DB after only a SELECT-based pre-check, with
 * no retry-on-race. Before the fix, a real Postgres EXCLUDE-constraint violation on that
 * write (a genuine lost race, not caught by the pre-check) propagated straight out of the
 * method uncaught, aborting the *entire* worker-deactivation transaction it always runs
 * inside — even other, unrelated bookings already reassigned earlier in the same loop.
 *
 * The candidate ranking/pre-check (_buildCandidateOrder, isWorkerFree) is deliberately
 * overridden on the service instance so the top candidate is forced deterministically,
 * rather than relying on timing-dependent concurrency to land the write in the exact race
 * window (see create-concurrency.integration.test.js for why raw two-writer races are only
 * used where the invariant under test doesn't depend on who wins). Everything the fix
 * actually touches — the real UPDATE, the real EXCLUDE constraint, the SAVEPOINT
 * rollback-and-retry — still goes through real Postgres, not mocks.
 */
describe('BookingService.reassignBookingsFromWorker (integration)', () => {
  let workerIds = [];
  let bookingIds = [];
  let preExistingActiveWorkerIds = [];

  beforeAll(async () => {
    const preExisting = await Worker.findAll({ where: { is_active: true }, attributes: ['id'] });
    preExistingActiveWorkerIds = preExisting.map((w) => w.id);
  });

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
    const targetIds = preExistingActiveWorkerIds.filter((id) => !excludeIds.includes(id));
    for (const workerId of targetIds) {
      try {
        const blocker = await Booking.create({ worker_id: workerId, customer_id: 999, ...slot, status: 'CONFIRMED' });
        bookingIds.push(blocker.id);
      } catch (err) {
        if (!isExclusionConstraintError(err)) throw err;
      }
    }
  }

  it('falls through to the second candidate, without aborting the deactivation, when the top candidate loses a real EXCLUDE-constraint race', async () => {
    const deactivating = await Worker.create({ name: 'Deactivating Worker', is_active: true });
    const candidateX = await Worker.create({ name: 'Top Candidate (already booked)', is_active: true });
    const candidateY = await Worker.create({ name: 'Second Candidate (free)', is_active: true });
    workerIds.push(deactivating.id, candidateX.id, candidateY.id);

    const slot = { start_time: nextTuesdayAt(11, 0), end_time: nextTuesdayAt(11, 30) };
    await blockOtherActiveWorkers([deactivating.id, candidateX.id, candidateY.id], slot);

    // A real, already-committed conflicting booking for candidateX — this is what the
    // real UPDATE inside the fix's SAVEPOINT must collide with and recover from.
    const blockerOnX = await Booking.create({
      worker_id: candidateX.id,
      customer_id: 999,
      ...slot,
      status: 'CONFIRMED',
    });
    bookingIds.push(blockerOnX.id);

    const bookingToReassign = await Booking.create({
      worker_id: deactivating.id,
      customer_id: 1,
      ...slot,
      status: 'PENDING',
    });
    bookingIds.push(bookingToReassign.id);

    const bookingService = buildService();
    // Force candidateX to be tried first and "look" free at the pre-check stage — the real
    // ranking/availability query would correctly exclude candidateX given the real blocker
    // above, which would only prove the ordinary skip-if-busy path (already covered
    // elsewhere), not the write-time race-recovery path this test exists for.
    bookingService._buildCandidateOrder = async () => [candidateX.id, candidateY.id];
    bookingService.bookingAvailabilityService.isWorkerFree = async () => true;

    const reassignments = await sequelize.transaction((transaction) =>
      bookingService.reassignBookingsFromWorker(deactivating.id, { transaction })
    );

    expect(reassignments).toEqual([{ booking_id: bookingToReassign.id, new_worker_id: candidateY.id }]);

    const updated = await Booking.findByPk(bookingToReassign.id);
    expect(updated.worker_id).toBe(candidateY.id);

    // candidateX's real conflicting booking is untouched — proof the failed write's
    // SAVEPOINT was rolled back cleanly rather than leaving anything half-applied.
    const blocker = await Booking.findByPk(blockerOnX.id);
    expect(blocker.worker_id).toBe(candidateX.id);
  }, 15000);
});
