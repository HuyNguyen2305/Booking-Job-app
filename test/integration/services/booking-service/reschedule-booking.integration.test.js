import { describe, it, expect, afterEach, beforeAll } from '@jest/globals';
import { nextTuesdayAt } from '#test/helpers/future-dates.js';

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
 * Real committed transactions (not seedWithTransaction's rollback pattern) — rescheduleBooking's
 * candidate loop opens its own internal sequelize.transaction() per attempt (via
 * _tryCandidates) and doesn't accept an external one, same reasoning as the other
 * BookingService integration tests in this suite.
 *
 * This dev DB may have real leftover active workers from manual/Swagger testing, so any
 * test that needs a specific worker to win explicitly blocks every other currently-active
 * worker for its slot first — same lesson learned in reassign-booking.integration.test.js.
 */
describe('BookingService.rescheduleBooking (integration)', () => {
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

  it('moves a booking to a new time window with the same worker and persists it', async () => {
    const worker = await Worker.create({ name: 'Reschedule Test Worker', is_active: true });
    workerIds.push(worker.id);

    const originalSlot = { start_time: nextTuesdayAt(9, 0), end_time: nextTuesdayAt(9, 30) };
    const booking = await Booking.create({ worker_id: worker.id, customer_id: 1, ...originalSlot, status: 'PENDING' });
    bookingIds.push(booking.id);

    const newSlot = { start_time: nextTuesdayAt(13, 0), end_time: nextTuesdayAt(13, 30) };
    const bookingService = buildService();
    const result = await bookingService.rescheduleBooking(booking.id, newSlot);

    expect(result.worker_id).toBe(worker.id);
    expect(result.reassigned).toBe(false);
    expect(new Date(result.start_time).toISOString()).toBe(new Date(newSlot.start_time).toISOString());

    const persisted = await Booking.findByPk(booking.id);
    expect(new Date(persisted.start_time).toISOString()).toBe(new Date(newSlot.start_time).toISOString());
  }, 15000);

  it('falls back to another active worker when the current one is no longer free at the new time', async () => {
    const workerA = await Worker.create({ name: 'Reschedule Busy Worker', is_active: true });
    const workerB = await Worker.create({ name: 'Reschedule Free Worker', is_active: true });
    workerIds.push(workerA.id, workerB.id);

    const originalSlot = { start_time: nextTuesdayAt(9, 0), end_time: nextTuesdayAt(9, 30) };
    const booking = await Booking.create({ worker_id: workerA.id, customer_id: 1, ...originalSlot, status: 'PENDING' });
    bookingIds.push(booking.id);

    const newSlot = { start_time: nextTuesdayAt(14, 0), end_time: nextTuesdayAt(14, 30) };
    await blockOtherActiveWorkers([workerA.id, workerB.id], newSlot);

    const conflictingBooking = await Booking.create({
      worker_id: workerA.id,
      customer_id: 2,
      ...newSlot,
      status: 'CONFIRMED',
    });
    bookingIds.push(conflictingBooking.id);

    const bookingService = buildService();
    const result = await bookingService.rescheduleBooking(booking.id, newSlot);

    expect(result.worker_id).toBe(workerB.id);
    expect(result.reassigned).toBe(true);
    expect(result.requested_worker_id).toBe(workerA.id);

    const persisted = await Booking.findByPk(booking.id);
    expect(persisted.worker_id).toBe(workerB.id);
  }, 15000);

  it('rejects rescheduling a booking whose own start_time has already passed', async () => {
    const worker = await Worker.create({ name: 'Reschedule Past Worker', is_active: true });
    workerIds.push(worker.id);

    // 2020-01-06T02:00:00Z/04:00:00Z = 09:00-11:00 local (Asia/Ho_Chi_Minh, UTC+7) on a
    // Monday, within business hours — a fixed past date so this stays valid indefinitely.
    const booking = await Booking.create({
      worker_id: worker.id,
      customer_id: 1,
      start_time: new Date('2020-01-06T02:00:00.000Z'),
      end_time: new Date('2020-01-06T04:00:00.000Z'),
      status: 'PENDING',
    });
    bookingIds.push(booking.id);

    const newSlot = { start_time: nextTuesdayAt(9, 0), end_time: nextTuesdayAt(9, 30) };
    const bookingService = buildService();

    await expect(bookingService.rescheduleBooking(booking.id, newSlot)).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.PAST_BOOKING_TIME,
    });

    const persisted = await Booking.findByPk(booking.id);
    expect(new Date(persisted.start_time).toISOString()).toBe('2020-01-06T02:00:00.000Z');
  });

  /**
   * Regression test for the bug fixed here: isAtLeastMinutesApart used to run before
   * checkSlotRules, so an offset-less new window (still a full valid 30-minute gap) got
   * masked behind a generic, code-less duration error instead of the real
   * INVALID_TIMESTAMP_FORMAT that checkSlotRules's format validation produces. Uses the
   * real (unmocked) BookingAvailabilityService + date.util, since the bug was specifically
   * about the interaction between the two real implementations.
   */
  it('rejects an offset-less new window with INVALID_TIMESTAMP_FORMAT, not a generic duration error', async () => {
    const worker = await Worker.create({ name: 'Reschedule Offset-less Worker', is_active: true });
    workerIds.push(worker.id);

    const originalSlot = { start_time: nextTuesdayAt(9, 0), end_time: nextTuesdayAt(9, 30) };
    const booking = await Booking.create({ worker_id: worker.id, customer_id: 1, ...originalSlot, status: 'PENDING' });
    bookingIds.push(booking.id);

    // nextTuesdayAt returns a full ISO string with an offset — slicing to the first 19
    // chars ("YYYY-MM-DDTHH:mm:ss") strips it, giving the same wall-clock time with no
    // offset. A full 30-minute gap, well over MIN_BOOKING_DURATION_MINUTES.
    const bookingService = buildService();

    await expect(
      bookingService.rescheduleBooking(booking.id, {
        start_time: nextTuesdayAt(15, 0).slice(0, 19),
        end_time: nextTuesdayAt(15, 30).slice(0, 19),
      })
    ).rejects.toMatchObject({ code: BOOKING_ERROR_CODES.INVALID_TIMESTAMP_FORMAT });
  });
});
