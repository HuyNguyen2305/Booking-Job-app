import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const bookingRepositoryMock = {
  findOverlappingForWorker: jest.fn(),
  create: jest.fn(),
};

const sequelizeMock = {
  transaction: jest.fn((callback) => callback('mock-transaction')),
};

jest.unstable_mockModule('#models/index', () => ({ sequelize: sequelizeMock }));

const { BookingService } = await import('#services/booking.service');
const { ValidationError, ConflictError } = await import('#configs/error');
const { BOOKING_STATUS } = await import('#constants/booking-status.const');

describe('BookingService.createBooking', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    sequelizeMock.transaction.mockImplementation((callback) => callback('mock-transaction'));
    service = Object.create(BookingService.prototype);
    service.bookingRepository = bookingRepositoryMock;
  });

  const payload = {
    worker_id: 1,
    customer_id: 2,
    start_time: '2026-07-09T09:00:00.000Z',
    end_time: '2026-07-09T09:30:00.000Z',
  };

  it('throws ValidationError when end_time is less than 30 minutes after start_time', async () => {
    const invalidPayload = { ...payload, end_time: '2026-07-09T09:29:59.000Z' };

    await expect(service.createBooking(invalidPayload)).rejects.toThrow(ValidationError);
    expect(bookingRepositoryMock.findOverlappingForWorker).not.toHaveBeenCalled();
    expect(bookingRepositoryMock.create).not.toHaveBeenCalled();
  });

  it('throws ConflictError when the worker already has an overlapping booking', async () => {
    bookingRepositoryMock.findOverlappingForWorker.mockResolvedValue({ id: 99 });

    await expect(service.createBooking(payload)).rejects.toThrow(ConflictError);
    expect(bookingRepositoryMock.findOverlappingForWorker).toHaveBeenCalledWith(
      payload.worker_id,
      payload.start_time,
      payload.end_time,
      { transaction: 'mock-transaction' }
    );
    expect(bookingRepositoryMock.create).not.toHaveBeenCalled();
  });

  it('creates the booking with PENDING status when duration is valid and there is no overlap', async () => {
    bookingRepositoryMock.findOverlappingForWorker.mockResolvedValue(null);
    const createdBooking = { id: 1, ...payload, status: BOOKING_STATUS.PENDING };
    bookingRepositoryMock.create.mockResolvedValue(createdBooking);

    const result = await service.createBooking(payload);

    expect(bookingRepositoryMock.create).toHaveBeenCalledWith(
      {
        worker_id: payload.worker_id,
        customer_id: payload.customer_id,
        start_time: payload.start_time,
        end_time: payload.end_time,
        status: BOOKING_STATUS.PENDING,
      },
      { transaction: 'mock-transaction' }
    );
    expect(result).toBe(createdBooking);
  });
});
