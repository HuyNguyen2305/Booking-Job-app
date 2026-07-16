import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const bookingRepositoryMock = {
  listActiveForCustomer: jest.fn(),
};

const { BookingService } = await import('#services/booking.service');

describe('BookingService.cancelBookingsForCustomer', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(BookingService.prototype);
    service.bookingRepository = bookingRepositoryMock;
  });

  it('returns empty cancelled/skipped when the customer has no active bookings', async () => {
    bookingRepositoryMock.listActiveForCustomer.mockResolvedValue([]);

    const result = await service.cancelBookingsForCustomer(1);

    expect(result).toEqual({ cancelled_booking_ids: [], skipped_booking_ids: [] });
  });

  it('cancels every active booking via cancelBooking', async () => {
    bookingRepositoryMock.listActiveForCustomer.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const cancelBookingSpy = jest.spyOn(service, 'cancelBooking').mockResolvedValue({ status: 'CANCELLED' });

    const result = await service.cancelBookingsForCustomer(1);

    expect(cancelBookingSpy).toHaveBeenCalledWith(1);
    expect(cancelBookingSpy).toHaveBeenCalledWith(2);
    expect(result).toEqual({ cancelled_booking_ids: [1, 2], skipped_booking_ids: [] });
  });

  it('collects a booking protected by the past-time guard as skipped, not a hard failure', async () => {
    bookingRepositoryMock.listActiveForCustomer.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const cancelBookingSpy = jest.spyOn(service, 'cancelBooking').mockImplementation(async (id) => {
      if (id === 2) throw new Error('Cannot cancel a booking whose time has already passed');
      return { status: 'CANCELLED' };
    });

    const result = await service.cancelBookingsForCustomer(1);

    expect(cancelBookingSpy).toHaveBeenCalledTimes(3);
    expect(result.cancelled_booking_ids).toEqual([1, 3]);
    expect(result.skipped_booking_ids).toEqual([
      { booking_id: 2, reason: 'Cannot cancel a booking whose time has already passed' },
    ]);
  });
});
