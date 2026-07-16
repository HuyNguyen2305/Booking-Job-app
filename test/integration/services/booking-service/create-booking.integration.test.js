import { describe, it, expect, afterEach, beforeAll } from '@jest/globals';
import { nextTuesdayAt } from '#test/helpers/future-dates.js';

const { BookingRepository } = await import('#repositories/booking.repository');
const { WorkerRepository } = await import('#repositories/worker.repository');
const { CustomerRepository } = await import('#repositories/customer.repository');
const { HolidayRepository } = await import('#repositories/holiday.repository');
const { BookingAvailabilityService } = await import('#services/booking-availability.service');
const { BookingService } = await import('#services/booking.service');
const { Worker } = await import('#models/worker.model');
const { Booking } = await import('#models/booking.model');
const { Customer } = await import('#models/customer.model');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');
const { isExclusionConstraintError } = await import('#utils/sequelize-error.util');

/**
 * Real committed transactions (not seedWithTransaction's rollback pattern) — createBooking's
 * candidate loop opens its own internal sequelize.transaction() per attempt (via
 * _tryCandidates) and doesn't accept an external one, same reasoning as the other
 * BookingService integration tests in this suite (cancel-booking, update-status, etc).
 *
 * This dev DB may have real leftover active workers from manual/Swagger testing, so any
 * test that needs a specific worker to win explicitly blocks every other currently-active
 * worker for its slot first — same lesson learned in reassign-booking.integration.test.js.
 */
describe('BookingService.createBooking (integration)', () => {
  let workerIds = [];
  let bookingIds = [];
  let customerIds = [];
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
    if (customerIds.length) {
      await Customer.destroy({ where: { id: customerIds } });
      customerIds = [];
    }
  });

  function buildService() {
    const bookingRepository = new BookingRepository();
    const workerRepository = new WorkerRepository();
    const customerRepository = new CustomerRepository();
    const holidayRepository = new HolidayRepository();

    const bookingAvailabilityService = Object.create(BookingAvailabilityService.prototype);
    bookingAvailabilityService.holidayRepository = holidayRepository;
    bookingAvailabilityService.bookingRepository = bookingRepository;

    const bookingService = Object.create(BookingService.prototype);
    bookingService.bookingRepository = bookingRepository;
    bookingService.workerRepository = workerRepository;
    bookingService.customerRepository = customerRepository;
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

  it('books the requested worker and persists the booking as PENDING', async () => {
    const customer = await Customer.create({ name: 'Create Booking Test Customer' });
    customerIds.push(customer.id);
    const worker = await Worker.create({ name: 'Create Booking Test Worker', is_active: true });
    workerIds.push(worker.id);

    const slot = { start_time: nextTuesdayAt(9, 0), end_time: nextTuesdayAt(9, 30) };
    const bookingService = buildService();
    const result = await bookingService.createBooking({ worker_id: worker.id, customer_id: customer.id, ...slot });
    bookingIds.push(result.id);

    expect(result.status).toBe('PENDING');
    expect(result.reassigned).toBe(false);

    // Independent re-read, not trusting what the service call returned.
    const persisted = await Booking.findByPk(result.id);
    expect(persisted.worker_id).toBe(worker.id);
    expect(persisted.customer_id).toBe(customer.id);
    expect(persisted.status).toBe('PENDING');
  }, 15000);

  it('falls back to another active worker when the requested one already has a real conflicting booking', async () => {
    const customer = await Customer.create({ name: 'Create Booking Fallback Customer' });
    customerIds.push(customer.id);
    const workerA = await Worker.create({ name: 'Busy Worker', is_active: true });
    const workerB = await Worker.create({ name: 'Free Worker', is_active: true });
    workerIds.push(workerA.id, workerB.id);

    const slot = { start_time: nextTuesdayAt(10, 0), end_time: nextTuesdayAt(10, 30) };
    await blockOtherActiveWorkers([workerA.id, workerB.id], slot);

    const existingBooking = await Booking.create({
      worker_id: workerA.id,
      customer_id: customer.id,
      ...slot,
      status: 'CONFIRMED',
    });
    bookingIds.push(existingBooking.id);

    const bookingService = buildService();
    const result = await bookingService.createBooking({ worker_id: workerA.id, customer_id: customer.id, ...slot });
    bookingIds.push(result.id);

    expect(result.worker_id).toBe(workerB.id);
    expect(result.reassigned).toBe(true);
    expect(result.requested_worker_id).toBe(workerA.id);

    const persisted = await Booking.findByPk(result.id);
    expect(persisted.worker_id).toBe(workerB.id);
  }, 15000);

  it('rejects with CUSTOMER_NOT_FOUND for a nonexistent customer_id', async () => {
    const worker = await Worker.create({ name: 'Orphan Booking Worker', is_active: true });
    workerIds.push(worker.id);

    const slot = { start_time: nextTuesdayAt(11, 0), end_time: nextTuesdayAt(11, 30) };
    const bookingService = buildService();

    await expect(
      bookingService.createBooking({ worker_id: worker.id, customer_id: 999999999, ...slot })
    ).rejects.toMatchObject({ code: BOOKING_ERROR_CODES.CUSTOMER_NOT_FOUND });
  });
});
