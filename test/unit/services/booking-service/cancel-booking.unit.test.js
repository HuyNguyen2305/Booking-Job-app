import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const bookingRepositoryMock = {
  getOne: jest.fn(),
  update: jest.fn(),
};

jest.unstable_mockModule('#models/index', () => ({ sequelize: { transaction: jest.fn() } }));

const { BookingService } = await import('#services/booking.service');
const { NotFoundError, ConflictError } = await import('#configs/error');
const { BOOKING_STATUS } = await import('#constants/booking-status.const');

describe('BookingService.cancelBooking', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(BookingService.prototype);
    service.bookingRepository = bookingRepositoryMock;
  });

  it('throws NotFoundError when the booking does not exist', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.cancelBooking(999)).rejects.toBeInstanceOf(NotFoundError);
    expect(bookingRepositoryMock.update).not.toHaveBeenCalled();
  });

  it.each([BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED])(
    'transitions a %s booking to CANCELLED',
    async (currentStatus) => {
      bookingRepositoryMock.getOne.mockResolvedValue({ id: 1, status: currentStatus });
      const updated = { id: 1, status: BOOKING_STATUS.CANCELLED };
      bookingRepositoryMock.update.mockResolvedValue(updated);

      const result = await service.cancelBooking(1);

      expect(bookingRepositoryMock.update).toHaveBeenCalledWith({ id: 1 }, { status: BOOKING_STATUS.CANCELLED });
      expect(result).toBe(updated);
    }
  );

  it.each([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED])(
    'throws ConflictError when the booking is already %s (terminal)',
    async (currentStatus) => {
      bookingRepositoryMock.getOne.mockResolvedValue({ id: 1, status: currentStatus });

      await expect(service.cancelBooking(1)).rejects.toBeInstanceOf(ConflictError);
      expect(bookingRepositoryMock.update).not.toHaveBeenCalled();
    }
  );
});
