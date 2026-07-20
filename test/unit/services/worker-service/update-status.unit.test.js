import { jest, describe, it, expect, beforeEach } from '@jest/globals';

process.env.BUSINESS_TZ = 'Asia/Ho_Chi_Minh';

const workerRepositoryMock = {
  getOne: jest.fn(),
  update: jest.fn(),
};
const bookingServiceMock = {
  reassignBookingsFromWorker: jest.fn(),
};
const sequelizeMock = {
  transaction: jest.fn((callback) => callback('mock-transaction')),
};

jest.unstable_mockModule('#models/index', () => ({ sequelize: sequelizeMock }));

const { WorkerService } = await import('#services/worker.service');
const { NotFoundError, ConflictError } = await import('#configs/error');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');

describe('WorkerService.updateStatus', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    sequelizeMock.transaction.mockImplementation((callback) => callback('mock-transaction'));
    service = Object.create(WorkerService.prototype);
    service.workerRepository = workerRepositoryMock;
    service.bookingService = bookingServiceMock;
  });

  it('throws NotFoundError when the worker does not exist', async () => {
    workerRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.updateStatus(999, false)).rejects.toBeInstanceOf(NotFoundError);
    expect(workerRepositoryMock.update).not.toHaveBeenCalled();
    expect(bookingServiceMock.reassignBookingsFromWorker).not.toHaveBeenCalled();
  });

  it('reactivates an inactive worker without touching bookings', async () => {
    workerRepositoryMock.getOne.mockResolvedValue({ id: 1, name: 'Alice', is_active: false });
    const updated = { id: 1, name: 'Alice', is_active: true };
    workerRepositoryMock.update.mockResolvedValue(updated);

    const result = await service.updateStatus(1, true);

    expect(workerRepositoryMock.update).toHaveBeenCalledWith({ id: 1 }, { is_active: true });
    expect(bookingServiceMock.reassignBookingsFromWorker).not.toHaveBeenCalled();
    expect(sequelizeMock.transaction).not.toHaveBeenCalled();
    expect(result).toBe(updated);
  });

  it('deactivates a worker after reassigning their open bookings, inside a single transaction', async () => {
    workerRepositoryMock.getOne.mockResolvedValue({ id: 1, name: 'Alice', is_active: true });
    const reassignments = [{ booking_id: 10, new_worker_id: 2 }];
    bookingServiceMock.reassignBookingsFromWorker.mockResolvedValue(reassignments);
    const updatedInstance = { toJSON: () => ({ id: 1, name: 'Alice', is_active: false }) };
    workerRepositoryMock.update.mockResolvedValue(updatedInstance);

    const result = await service.updateStatus(1, false);

    expect(bookingServiceMock.reassignBookingsFromWorker).toHaveBeenCalledWith(1, { transaction: 'mock-transaction' });
    expect(workerRepositoryMock.update).toHaveBeenCalledWith(
      { id: 1 },
      { is_active: false },
      { transaction: 'mock-transaction' }
    );
    expect(result).toEqual({ id: 1, name: 'Alice', is_active: false, reassigned_bookings: reassignments });
  });

  it('leaves the worker active when a booking has no available replacement', async () => {
    workerRepositoryMock.getOne.mockResolvedValue({ id: 1, name: 'Alice', is_active: true });
    bookingServiceMock.reassignBookingsFromWorker.mockRejectedValue(
      new ConflictError('Cannot deactivate worker: booking 10 has no available replacement worker', {
        code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
      })
    );

    await expect(service.updateStatus(1, false)).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
    });
    expect(workerRepositoryMock.update).not.toHaveBeenCalled();
  });
});
