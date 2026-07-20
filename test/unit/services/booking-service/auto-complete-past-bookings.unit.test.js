import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const bookingRepositoryMock = {
  listPastConfirmed: jest.fn(),
};

const { BookingService } = await import('#services/booking.service');
const { BOOKING_STATUS } = await import('#constants/booking-status.const');

describe('BookingService.autoCompletePastBookings', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(BookingService.prototype);
    service.bookingRepository = bookingRepositoryMock;
  });

  it('returns empty completed/failed when there are no due bookings', async () => {
    bookingRepositoryMock.listPastConfirmed.mockResolvedValue([]);

    const result = await service.autoCompletePastBookings();

    expect(result).toEqual({ completed: [], failed: [] });
  });

  it('completes every due booking via updateStatus', async () => {
    bookingRepositoryMock.listPastConfirmed.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const updateStatusSpy = jest.spyOn(service, 'updateStatus').mockResolvedValue({ status: BOOKING_STATUS.COMPLETED });

    const result = await service.autoCompletePastBookings();

    expect(updateStatusSpy).toHaveBeenCalledWith(1, BOOKING_STATUS.COMPLETED);
    expect(updateStatusSpy).toHaveBeenCalledWith(2, BOOKING_STATUS.COMPLETED);
    expect(result).toEqual({ completed: [1, 2], failed: [] });
  });

  it('collects a failure without stopping the rest of the sweep', async () => {
    bookingRepositoryMock.listPastConfirmed.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const updateStatusSpy = jest.spyOn(service, 'updateStatus').mockImplementation(async (id) => {
      if (id === 2) throw new Error('exclusion violation');
      return { status: BOOKING_STATUS.COMPLETED };
    });

    const result = await service.autoCompletePastBookings();

    expect(updateStatusSpy).toHaveBeenCalledTimes(3);
    expect(result.completed).toEqual([1, 3]);
    expect(result.failed).toEqual([{ booking_id: 2, message: 'exclusion violation' }]);
  });
});
