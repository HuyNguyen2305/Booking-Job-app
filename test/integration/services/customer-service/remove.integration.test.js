import { describe, it, expect, afterEach } from '@jest/globals';
import { nextTuesdayAt } from '#test/helpers/future-dates.js';

const { CustomerRepository } = await import('#repositories/customer.repository');
const { BookingRepository } = await import('#repositories/booking.repository');
const { WorkerRepository } = await import('#repositories/worker.repository');
const { HolidayRepository } = await import('#repositories/holiday.repository');
const { BookingAvailabilityService } = await import('#services/booking-availability.service');
const { BookingService } = await import('#services/booking.service');
const { CustomerService } = await import('#services/customer.service');
const { Customer } = await import('#models/customer.model');
const { Booking } = await import('#models/booking.model');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');

/**
 * Real committed rows (not seedWithTransaction's rollback pattern) — CustomerService.remove
 * calls BookingService.cancelBookingsForCustomer, which calls cancelBooking/updateStatus per
 * booking; those open their own internal transactions and don't accept an external one, same
 * reasoning as cancel-booking.integration.test.js.
 */
describe('CustomerService.remove (integration)', () => {
  let customerIds = [];
  let bookingIds = [];

  afterEach(async () => {
    if (bookingIds.length) {
      await Booking.destroy({ where: { id: bookingIds } });
      bookingIds = [];
    }
    if (customerIds.length) {
      await Customer.destroy({ where: { id: customerIds } });
      customerIds = [];
    }
  });

  function buildServices() {
    const customerRepository = new CustomerRepository();
    const bookingRepository = new BookingRepository();
    const workerRepository = new WorkerRepository();
    const holidayRepository = new HolidayRepository();

    const bookingAvailabilityService = Object.create(BookingAvailabilityService.prototype);
    bookingAvailabilityService.holidayRepository = holidayRepository;
    bookingAvailabilityService.bookingRepository = bookingRepository;

    const bookingService = Object.create(BookingService.prototype);
    bookingService.bookingRepository = bookingRepository;
    bookingService.workerRepository = workerRepository;
    bookingService.customerRepository = customerRepository;
    bookingService.bookingAvailabilityService = bookingAvailabilityService;

    const customerService = Object.create(CustomerService.prototype);
    customerService.customerRepository = customerRepository;
    customerService.bookingService = bookingService;

    return { customerService, bookingService };
  }

  it('cancels upcoming PENDING/CONFIRMED bookings but leaves an in-progress CONFIRMED booking untouched', async () => {
    const customer = await Customer.create({ name: 'Delete Me' });
    customerIds.push(customer.id);

    const pending = await Booking.create({
      worker_id: 999801,
      customer_id: customer.id,
      start_time: nextTuesdayAt(9, 0),
      end_time: nextTuesdayAt(10, 0),
      status: 'PENDING',
    });
    const confirmedFuture = await Booking.create({
      worker_id: 999802,
      customer_id: customer.id,
      start_time: nextTuesdayAt(11, 0),
      end_time: nextTuesdayAt(12, 0),
      status: 'CONFIRMED',
    });
    // 2020-01-06T02:00:00Z/04:00:00Z = 09:00-11:00 local (Asia/Ho_Chi_Minh, UTC+7) on a
    // Monday, within business hours — a fixed past date so this stays valid indefinitely.
    const confirmedInProgress = await Booking.create({
      worker_id: 999803,
      customer_id: customer.id,
      start_time: new Date('2020-01-06T02:00:00.000Z'),
      end_time: new Date('2020-01-06T04:00:00.000Z'),
      status: 'CONFIRMED',
    });
    bookingIds.push(pending.id, confirmedFuture.id, confirmedInProgress.id);

    const { customerService } = buildServices();
    const result = await customerService.remove(customer.id);

    expect(result.is_active).toBe(false);
    expect([...result.cancelled_booking_ids].sort((a, b) => a - b)).toEqual(
      [pending.id, confirmedFuture.id].sort((a, b) => a - b)
    );
    expect(result.skipped_booking_ids).toEqual([
      { booking_id: confirmedInProgress.id, reason: 'Cannot cancel a booking whose time has already passed' },
    ]);

    // Independent re-reads, not trusting what the service call returned.
    const persistedCustomer = await Customer.findByPk(customer.id);
    expect(persistedCustomer.is_active).toBe(false);

    const persistedPending = await Booking.findByPk(pending.id);
    expect(persistedPending.status).toBe('CANCELLED');

    const persistedConfirmedFuture = await Booking.findByPk(confirmedFuture.id);
    expect(persistedConfirmedFuture.status).toBe('CANCELLED');

    const persistedConfirmedInProgress = await Booking.findByPk(confirmedInProgress.id);
    expect(persistedConfirmedInProgress.status).toBe('CONFIRMED');
  });

  it('blocks new bookings from being created against a deleted customer', async () => {
    const customer = await Customer.create({ name: 'Delete Me Too' });
    customerIds.push(customer.id);

    const { customerService, bookingService } = buildServices();
    await customerService.remove(customer.id);

    await expect(
      bookingService.createBooking({
        worker_id: 1,
        customer_id: customer.id,
        start_time: nextTuesdayAt(9, 0),
        end_time: nextTuesdayAt(9, 30),
      })
    ).rejects.toMatchObject({ code: BOOKING_ERROR_CODES.CUSTOMER_NOT_FOUND });
  });
});
