import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { DateTime } from 'luxon';

process.env.BUSINESS_TZ = 'Asia/Ho_Chi_Minh';

const bookingRepositoryMock = {
  getOne: jest.fn(),
  update: jest.fn(),
};
const workerRepositoryMock = {
  listActive: jest.fn(),
  getAvailability: jest.fn(),
};
const bookingAvailabilityServiceMock = {
  isWorkerFree: jest.fn(),
};

const sequelizeMock = {
  transaction: jest.fn((callback) => callback('mock-transaction')),
};

jest.unstable_mockModule('#models/index', () => ({ sequelize: sequelizeMock }));

const { BookingService } = await import('#services/booking.service');
const { NotFoundError, ConflictError } = await import('#configs/error');
const { BOOKING_STATUS } = await import('#constants/booking-status.const');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');

describe('BookingService.reassignBooking', () => {
  let service;

  // Computed relative to the real clock (not a hardcoded date) so this stays a valid
  // "not yet passed" booking indefinitely.
  const slot = {
    start_time: DateTime.now().plus({ days: 30 }).toJSDate(),
    end_time: DateTime.now().plus({ days: 30 }).plus({ minutes: 30 }).toJSDate(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sequelizeMock.transaction.mockImplementation((callback) => callback('mock-transaction'));
    workerRepositoryMock.listActive.mockResolvedValue([]);

    service = Object.create(BookingService.prototype);
    service.bookingRepository = bookingRepositoryMock;
    service.workerRepository = workerRepositoryMock;
    service.bookingAvailabilityService = bookingAvailabilityServiceMock;
  });

  it('throws NotFoundError when the booking does not exist', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.reassignBooking(999)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ConflictError when the booking is COMPLETED or CANCELLED', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue({ id: 1, worker_id: 5, status: BOOKING_STATUS.COMPLETED, ...slot });

    await expect(service.reassignBooking(1)).rejects.toBeInstanceOf(ConflictError);
    expect(bookingAvailabilityServiceMock.isWorkerFree).not.toHaveBeenCalled();
  });

  it('throws ConflictError with PAST_BOOKING_TIME when the booking time has already passed', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue({
      id: 1,
      worker_id: 5,
      status: BOOKING_STATUS.PENDING,
      start_time: new Date('2020-01-06T09:00:00+07:00'),
      end_time: new Date('2020-01-06T09:30:00+07:00'),
    });

    await expect(service.reassignBooking(1)).rejects.toMatchObject({ code: BOOKING_ERROR_CODES.PAST_BOOKING_TIME });
    expect(bookingAvailabilityServiceMock.isWorkerFree).not.toHaveBeenCalled();
  });

  it('moves the booking to another active worker, never offering the current worker back', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue({ id: 1, worker_id: 5, status: BOOKING_STATUS.PENDING, ...slot });
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 5 }, { id: 6 }]);
    workerRepositoryMock.getAvailability.mockResolvedValue([{ worker_id: 6, has_overlap: false, booked_hours: 0 }]);
    bookingAvailabilityServiceMock.isWorkerFree.mockResolvedValue(true);
    const updated = { toJSON: () => ({ id: 1, worker_id: 6, status: BOOKING_STATUS.PENDING }) };
    bookingRepositoryMock.update.mockResolvedValue(updated);

    const result = await service.reassignBooking(1);

    expect(bookingAvailabilityServiceMock.isWorkerFree).toHaveBeenCalledWith(
      6,
      slot.start_time.toISOString(),
      slot.end_time.toISOString(),
      { transaction: 'mock-transaction', excludeId: 1 }
    );
    expect(bookingRepositoryMock.update).toHaveBeenCalledWith(
      { id: 1 },
      { worker_id: 6 },
      { transaction: 'mock-transaction' }
    );
    expect(result.reassigned).toBe(true);
    expect(result.requested_worker_id).toBe(5);
  });

  it('throws ConflictError with WORKER_UNAVAILABLE when no other worker is free', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue({ id: 1, worker_id: 5, status: BOOKING_STATUS.CONFIRMED, ...slot });
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 5 }, { id: 6 }]);
    workerRepositoryMock.getAvailability.mockResolvedValue([{ worker_id: 6, has_overlap: false, booked_hours: 0 }]);
    bookingAvailabilityServiceMock.isWorkerFree.mockResolvedValue(false);

    await expect(service.reassignBooking(1)).rejects.toMatchObject({ code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE });
    expect(bookingRepositoryMock.update).not.toHaveBeenCalled();
  });

  it('throws ConflictError with WORKER_UNAVAILABLE when there are no other active workers at all', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue({ id: 1, worker_id: 5, status: BOOKING_STATUS.PENDING, ...slot });
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 5 }]);

    await expect(service.reassignBooking(1)).rejects.toMatchObject({ code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE });
    expect(bookingAvailabilityServiceMock.isWorkerFree).not.toHaveBeenCalled();
  });
});
