import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const bookingRepositoryMock = {
  getOne: jest.fn(),
  update: jest.fn(),
};

jest.unstable_mockModule('#models/index', () => ({ sequelize: { transaction: jest.fn() } }));

const { BookingService } = await import('#services/booking.service');
const { NotFoundError, ConflictError } = await import('#configs/error');
const { BOOKING_STATUS } = await import('#constants/booking-status.const');

describe('BookingService.updateStatus', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(BookingService.prototype);
    service.bookingRepository = bookingRepositoryMock;
  });

  it('throws NotFoundError when the booking does not exist', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.updateStatus(1, BOOKING_STATUS.CONFIRMED)).rejects.toThrow(NotFoundError);
    expect(bookingRepositoryMock.update).not.toHaveBeenCalled();
  });

  const allowedTransitions = [
    [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED],
    [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED],
    [BOOKING_STATUS.PENDING, BOOKING_STATUS.CANCELLED],
    [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED],
  ];

  it.each(allowedTransitions)('allows transition from %s to %s', async (currentStatus, nextStatus) => {
    bookingRepositoryMock.getOne.mockResolvedValue({ id: 1, status: currentStatus });
    const updatedBooking = { id: 1, status: nextStatus };
    bookingRepositoryMock.update.mockResolvedValue(updatedBooking);

    const result = await service.updateStatus(1, nextStatus);

    expect(bookingRepositoryMock.update).toHaveBeenCalledWith({ id: 1 }, { status: nextStatus });
    expect(result).toBe(updatedBooking);
  });

  const disallowedTransitions = [
    [BOOKING_STATUS.PENDING, BOOKING_STATUS.COMPLETED], // skip-ahead
    [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING], // backwards
    [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CONFIRMED], // terminal state
    [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED], // terminal state
    [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.PENDING], // terminal state
  ];

  it.each(disallowedTransitions)('rejects transition from %s to %s', async (currentStatus, nextStatus) => {
    bookingRepositoryMock.getOne.mockResolvedValue({ id: 1, status: currentStatus });

    await expect(service.updateStatus(1, nextStatus)).rejects.toThrow(ConflictError);
    expect(bookingRepositoryMock.update).not.toHaveBeenCalled();
  });
});
