import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const bookingRepositoryMock = {
  getOne: jest.fn(),
  updateStatusIfUnchanged: jest.fn(),
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
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');

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
    expect(bookingRepositoryMock.updateStatusIfUnchanged).not.toHaveBeenCalled();
  });

  const allowedTransitions = [
    [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED],
    [BOOKING_STATUS.PENDING, BOOKING_STATUS.CANCELLED],
    [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED],
  ];

  it.each(allowedTransitions)('allows transition from %s to %s', async (currentStatus, nextStatus) => {
    bookingRepositoryMock.getOne.mockResolvedValue({ id: 1, status: currentStatus });
    const updatedBooking = { id: 1, status: nextStatus };
    bookingRepositoryMock.updateStatusIfUnchanged.mockResolvedValue(updatedBooking);

    const result = await service.updateStatus(1, nextStatus);

    expect(bookingRepositoryMock.updateStatusIfUnchanged).toHaveBeenCalledWith(1, currentStatus, nextStatus);
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
    expect(bookingRepositoryMock.updateStatusIfUnchanged).not.toHaveBeenCalled();
  });

  describe('transitioning to CANCELLED after start_time has passed', () => {
    it('throws ConflictError with PAST_BOOKING_TIME for a CONFIRMED booking (worker already committed to it)', async () => {
      bookingRepositoryMock.getOne.mockResolvedValue({
        id: 1,
        status: BOOKING_STATUS.CONFIRMED,
        start_time: new Date('2020-01-06T02:00:00.000Z'),
      });

      await expect(service.updateStatus(1, BOOKING_STATUS.CANCELLED)).rejects.toMatchObject({
        code: BOOKING_ERROR_CODES.PAST_BOOKING_TIME,
      });
      expect(bookingRepositoryMock.updateStatusIfUnchanged).not.toHaveBeenCalled();
    });

    it('still cancels a PENDING booking regardless of timing (nobody ever committed to it)', async () => {
      bookingRepositoryMock.getOne.mockResolvedValue({
        id: 1,
        status: BOOKING_STATUS.PENDING,
        start_time: new Date('2020-01-06T02:00:00.000Z'),
      });
      const updatedBooking = { id: 1, status: BOOKING_STATUS.CANCELLED };
      bookingRepositoryMock.updateStatusIfUnchanged.mockResolvedValue(updatedBooking);

      const result = await service.updateStatus(1, BOOKING_STATUS.CANCELLED);

      expect(bookingRepositoryMock.updateStatusIfUnchanged).toHaveBeenCalledWith(
        1,
        BOOKING_STATUS.PENDING,
        BOOKING_STATUS.CANCELLED
      );
      expect(result).toBe(updatedBooking);
    });

    it('does not block COMPLETED for a past booking (auto-completion relies on this)', async () => {
      bookingRepositoryMock.getOne.mockResolvedValue({
        id: 1,
        status: BOOKING_STATUS.CONFIRMED,
        worker_id: 7,
        start_time: '2020-01-06T02:00:00.000Z',
        end_time: '2020-01-06T04:00:00.000Z',
      });
      const updatedBooking = { id: 1, status: BOOKING_STATUS.COMPLETED };
      bookingRepositoryMock.updateStatusIfUnchanged.mockResolvedValue(updatedBooking);

      const result = await service.updateStatus(1, BOOKING_STATUS.COMPLETED);

      expect(result).toBe(updatedBooking);
    });
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
      bookingRepositoryMock.updateStatusIfUnchanged.mockResolvedValue(updatedBooking);

      const result = await service.updateStatus(1, BOOKING_STATUS.COMPLETED);

      expect(bookingRepositoryMock.updateStatusIfUnchanged).toHaveBeenCalledWith(
        1,
        BOOKING_STATUS.CONFIRMED,
        BOOKING_STATUS.COMPLETED,
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
      bookingRepositoryMock.updateStatusIfUnchanged.mockResolvedValue({ id: 1, status: BOOKING_STATUS.COMPLETED });
      workerRepositoryMock.incrementTotalHours.mockRejectedValue(new Error('db error'));
      sequelizeMock.transaction.mockImplementation(async (callback) => callback('mock-transaction'));

      await expect(service.updateStatus(1, BOOKING_STATUS.COMPLETED)).rejects.toThrow('db error');
    });

    it('throws ConflictError with CONCURRENT_STATUS_CHANGE when a concurrent transition wins the race, without incrementing hours', async () => {
      bookingRepositoryMock.getOne.mockResolvedValue(booking);
      bookingRepositoryMock.updateStatusIfUnchanged.mockResolvedValue(null);

      await expect(service.updateStatus(1, BOOKING_STATUS.COMPLETED)).rejects.toMatchObject({
        code: BOOKING_ERROR_CODES.CONCURRENT_STATUS_CHANGE,
      });
      expect(workerRepositoryMock.incrementTotalHours).not.toHaveBeenCalled();
    });
  });

  it('throws ConflictError with CONCURRENT_STATUS_CHANGE for a non-COMPLETED transition when the race is lost', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue({ id: 1, status: BOOKING_STATUS.PENDING });
    bookingRepositoryMock.updateStatusIfUnchanged.mockResolvedValue(null);

    await expect(service.updateStatus(1, BOOKING_STATUS.CONFIRMED)).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.CONCURRENT_STATUS_CHANGE,
    });
  });
});
