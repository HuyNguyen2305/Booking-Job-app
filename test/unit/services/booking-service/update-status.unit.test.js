import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const bookingRepositoryMock = {
  getOne: jest.fn(),
  update: jest.fn(),
};
const workerRepositoryMock = {
  incrementTotalHours: jest.fn(),
};

const sequelizeMock = {
  transaction: jest.fn((callback) => callback('mock-transaction')),
};

jest.unstable_mockModule('#models/index', () => ({ sequelize: sequelizeMock }));

const { BookingService } = await import('#services/booking.service');
const { NotFoundError, ConflictError } = await import('#configs/error');
const { BOOKING_STATUS } = await import('#constants/booking-status.const');

describe('BookingService.updateStatus', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    sequelizeMock.transaction.mockImplementation((callback) => callback('mock-transaction'));
    service = Object.create(BookingService.prototype);
    service.bookingRepository = bookingRepositoryMock;
    service.workerRepository = workerRepositoryMock;
  });

  it('throws NotFoundError when the booking does not exist', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.updateStatus(1, BOOKING_STATUS.CONFIRMED)).rejects.toThrow(NotFoundError);
    expect(bookingRepositoryMock.update).not.toHaveBeenCalled();
  });

  const allowedTransitions = [
    [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED],
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
    expect(workerRepositoryMock.incrementTotalHours).not.toHaveBeenCalled();
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

  describe('transitioning to COMPLETED', () => {
    const booking = {
      id: 1,
      status: BOOKING_STATUS.CONFIRMED,
      worker_id: 7,
      start_time: '2026-07-14T09:00:00.000Z',
      end_time: '2026-07-14T11:30:00.000Z', // 2.5 hours
    };

    it('completes the booking and atomically adds its duration to the worker\'s total_hours in one transaction', async () => {
      bookingRepositoryMock.getOne.mockResolvedValue(booking);
      const updatedBooking = { id: 1, status: BOOKING_STATUS.COMPLETED };
      bookingRepositoryMock.update.mockResolvedValue(updatedBooking);

      const result = await service.updateStatus(1, BOOKING_STATUS.COMPLETED);

      expect(bookingRepositoryMock.update).toHaveBeenCalledWith(
        { id: 1 },
        { status: BOOKING_STATUS.COMPLETED },
        { transaction: 'mock-transaction' }
      );
      expect(workerRepositoryMock.incrementTotalHours).toHaveBeenCalledWith(7, 2.5, { transaction: 'mock-transaction' });
      expect(result).toBe(updatedBooking);
    });

    it('propagates a failure from the hours increment instead of swallowing it', async () => {
      // Real rollback of the already-applied status update on this failure is a
      // genuine Postgres transaction guarantee, verified at the integration level
      // (see worker-service/update-status.integration.test.js's analogous case) —
      // this only checks the error surfaces from updateStatus rather than being lost.
      bookingRepositoryMock.getOne.mockResolvedValue(booking);
      bookingRepositoryMock.update.mockResolvedValue({ id: 1, status: BOOKING_STATUS.COMPLETED });
      workerRepositoryMock.incrementTotalHours.mockRejectedValue(new Error('db error'));
      sequelizeMock.transaction.mockImplementation(async (callback) => callback('mock-transaction'));

      await expect(service.updateStatus(1, BOOKING_STATUS.COMPLETED)).rejects.toThrow('db error');
    });
  });
});
