import { describe, it, expect, afterEach } from '@jest/globals';
import { nextTuesdayAt } from '#test/helpers/future-dates.js';

const { BookingRepository } = await import('#repositories/booking.repository');
const { BookingService } = await import('#services/booking.service');
const { Booking } = await import('#models/booking.model');

/**
 * Real committed row (not seedWithTransaction's rollback pattern) — cancelBooking/
 * updateStatus don't accept an external transaction (unlike createBooking/reschedule/
 * reassign, which all open their own), so a row seeded inside an uncommitted outer
 * transaction wouldn't be visible to the service's own separate connection. Cleaned up
 * directly via Booking.destroy() in afterEach.
 */
describe('BookingService.cancelBooking (integration)', () => {
  let bookingIds = [];

  afterEach(async () => {
    if (bookingIds.length) {
      await Booking.destroy({ where: { id: bookingIds } });
      bookingIds = [];
    }
  });

  function buildService() {
    const bookingService = Object.create(BookingService.prototype);
    bookingService.bookingRepository = new BookingRepository();
    return bookingService;
  }

  it('actually persists status: CANCELLED to the database, not just the returned object', async () => {
    const slot = { start_time: nextTuesdayAt(14, 0), end_time: nextTuesdayAt(14, 30) };
    const booking = await Booking.create({ worker_id: 999901, customer_id: 1, ...slot, status: 'PENDING' });
    bookingIds.push(booking.id);

    const bookingService = buildService();
    const result = await bookingService.cancelBooking(booking.id);

    expect(result.status).toBe('CANCELLED');

    // Independent re-read straight from the DB, bypassing anything the service call
    // might have returned from memory, to prove the write actually landed.
    const persisted = await Booking.findByPk(booking.id);
    expect(persisted.status).toBe('CANCELLED');
  });

  it('does not change the status when the booking is already COMPLETED (rejects instead)', async () => {
    const slot = { start_time: nextTuesdayAt(15, 0), end_time: nextTuesdayAt(15, 30) };
    const booking = await Booking.create({ worker_id: 999902, customer_id: 1, ...slot, status: 'COMPLETED' });
    bookingIds.push(booking.id);

    const bookingService = buildService();

    await expect(bookingService.cancelBooking(booking.id)).rejects.toMatchObject({ statusCode: 409 });

    const persisted = await Booking.findByPk(booking.id);
    expect(persisted.status).toBe('COMPLETED');
  });
});
