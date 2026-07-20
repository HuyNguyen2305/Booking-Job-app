import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ExclusionConstraintError } from 'sequelize';

process.env.BUSINESS_TZ = 'Asia/Ho_Chi_Minh';

const bookingRepositoryMock = {
  listReassignableForWorker: jest.fn(),
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
  transaction: jest.fn((opts, callback) => callback('mock-savepoint')),
};

jest.unstable_mockModule('#models/index', () => ({ sequelize: sequelizeMock }));

const { BookingService } = await import('#services/booking.service');
const { ConflictError } = await import('#configs/error');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');

describe('BookingService.reassignBookingsFromWorker', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    sequelizeMock.transaction.mockImplementation((opts, callback) => callback('mock-savepoint'));
    service = Object.create(BookingService.prototype);
    service.bookingRepository = bookingRepositoryMock;
    service.workerRepository = workerRepositoryMock;
    service.bookingAvailabilityService = bookingAvailabilityServiceMock;
  });

  it('returns an empty array when the worker has no reassignable bookings', async () => {
    bookingRepositoryMock.listReassignableForWorker.mockResolvedValue([]);

    const result = await service.reassignBookingsFromWorker(1, { transaction: 'tx' });

    expect(result).toEqual([]);
    expect(bookingRepositoryMock.update).not.toHaveBeenCalled();
  });

  it('reassigns a single booking to the best available other active worker', async () => {
    bookingRepositoryMock.listReassignableForWorker.mockResolvedValue([
      {
        id: 10,
        worker_id: 1,
        start_time: new Date('2026-07-14T09:00:00+07:00'),
        end_time: new Date('2026-07-14T09:30:00+07:00'),
      },
    ]);
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    workerRepositoryMock.getAvailability.mockResolvedValue([{ worker_id: 2, has_overlap: false, booked_hours: 0 }]);
    bookingAvailabilityServiceMock.isWorkerFree.mockResolvedValue(true);

    const result = await service.reassignBookingsFromWorker(1, { transaction: 'tx' });

    // start_time/end_time come back from Sequelize as Date objects; reassignBookingsFromWorker
    // must convert them to ISO strings before passing downstream (that conversion was the bug).
    expect(bookingAvailabilityServiceMock.isWorkerFree).toHaveBeenCalledWith(
      2,
      '2026-07-14T02:00:00.000Z',
      '2026-07-14T02:30:00.000Z',
      { transaction: 'mock-savepoint', excludeId: 10 }
    );
    expect(bookingRepositoryMock.update).toHaveBeenCalledWith(
      { id: 10 },
      { worker_id: 2 },
      { transaction: 'mock-savepoint' }
    );
    expect(sequelizeMock.transaction).toHaveBeenCalledWith({ transaction: 'tx' }, expect.any(Function));
    expect(result).toEqual([{ booking_id: 10, new_worker_id: 2 }]);
  });

  it('never offers the worker being deactivated as its own replacement', async () => {
    bookingRepositoryMock.listReassignableForWorker.mockResolvedValue([
      {
        id: 10,
        worker_id: 1,
        start_time: new Date('2026-07-14T09:00:00+07:00'),
        end_time: new Date('2026-07-14T09:30:00+07:00'),
      },
    ]);
    // Worker 1 (being deactivated) is still active in the roster at this point in the
    // transaction (its is_active flip hasn't happened yet) — it must still be excluded.
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 1 }]);

    await expect(service.reassignBookingsFromWorker(1, { transaction: 'tx' })).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
    });
    expect(bookingAvailabilityServiceMock.isWorkerFree).not.toHaveBeenCalled();
  });

  it('throws ConflictError with WORKER_UNAVAILABLE when a booking has no available replacement', async () => {
    bookingRepositoryMock.listReassignableForWorker.mockResolvedValue([
      {
        id: 10,
        worker_id: 1,
        start_time: new Date('2026-07-14T09:00:00+07:00'),
        end_time: new Date('2026-07-14T09:30:00+07:00'),
      },
    ]);
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    workerRepositoryMock.getAvailability.mockResolvedValue([{ worker_id: 2, has_overlap: false, booked_hours: 0 }]);
    bookingAvailabilityServiceMock.isWorkerFree.mockResolvedValue(false);

    await expect(service.reassignBookingsFromWorker(1, { transaction: 'tx' })).rejects.toBeInstanceOf(ConflictError);
    await expect(service.reassignBookingsFromWorker(1, { transaction: 'tx' })).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
    });
    expect(bookingRepositoryMock.update).not.toHaveBeenCalled();
  });

  it('stops at the first unassignable booking without reassigning later ones', async () => {
    bookingRepositoryMock.listReassignableForWorker.mockResolvedValue([
      {
        id: 10,
        worker_id: 1,
        start_time: new Date('2026-07-14T09:00:00+07:00'),
        end_time: new Date('2026-07-14T09:30:00+07:00'),
      },
      {
        id: 11,
        worker_id: 1,
        start_time: new Date('2026-07-14T11:00:00+07:00'),
        end_time: new Date('2026-07-14T11:30:00+07:00'),
      },
    ]);
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    workerRepositoryMock.getAvailability.mockResolvedValue([{ worker_id: 2, has_overlap: false, booked_hours: 0 }]);
    bookingAvailabilityServiceMock.isWorkerFree.mockResolvedValue(false);

    await expect(service.reassignBookingsFromWorker(1, { transaction: 'tx' })).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
    });
    expect(bookingRepositoryMock.update).not.toHaveBeenCalled();
    // Only the first booking's candidate should have been probed before throwing.
    expect(bookingAvailabilityServiceMock.isWorkerFree).toHaveBeenCalledTimes(1);
  });

  it('reassigns multiple bookings, each to their own best candidate', async () => {
    bookingRepositoryMock.listReassignableForWorker.mockResolvedValue([
      {
        id: 10,
        worker_id: 1,
        start_time: new Date('2026-07-14T09:00:00+07:00'),
        end_time: new Date('2026-07-14T09:30:00+07:00'),
      },
      {
        id: 11,
        worker_id: 1,
        start_time: new Date('2026-07-14T11:00:00+07:00'),
        end_time: new Date('2026-07-14T11:30:00+07:00'),
      },
    ]);
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    workerRepositoryMock.getAvailability.mockResolvedValue([
      { worker_id: 2, has_overlap: false, booked_hours: 1 },
      { worker_id: 3, has_overlap: false, booked_hours: 0 },
    ]);
    bookingAvailabilityServiceMock.isWorkerFree.mockResolvedValue(true);

    const result = await service.reassignBookingsFromWorker(1, { transaction: 'tx' });

    // Ranked ascending by booked_hours -> worker 3 (0h) is the top candidate for both.
    expect(result).toEqual([
      { booking_id: 10, new_worker_id: 3 },
      { booking_id: 11, new_worker_id: 3 },
    ]);
    expect(bookingRepositoryMock.update).toHaveBeenCalledTimes(2);
  });

  it('falls through to the next candidate when the first one loses a real EXCLUDE-constraint race', async () => {
    bookingRepositoryMock.listReassignableForWorker.mockResolvedValue([
      {
        id: 10,
        worker_id: 1,
        start_time: new Date('2026-07-14T09:00:00+07:00'),
        end_time: new Date('2026-07-14T09:30:00+07:00'),
      },
    ]);
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    workerRepositoryMock.getAvailability.mockResolvedValue([
      { worker_id: 2, has_overlap: false, booked_hours: 0 },
      { worker_id: 3, has_overlap: false, booked_hours: 1 },
    ]);
    bookingAvailabilityServiceMock.isWorkerFree.mockResolvedValue(true);

    const exclusionError = new ExclusionConstraintError({ message: 'conflicting key value' });
    bookingRepositoryMock.update.mockRejectedValueOnce(exclusionError).mockResolvedValueOnce({ id: 10, worker_id: 3 });

    const result = await service.reassignBookingsFromWorker(1, { transaction: 'tx' });

    // Worker 2 (ranked first) loses the race; worker 3 is tried next and succeeds.
    expect(bookingRepositoryMock.update).toHaveBeenCalledTimes(2);
    expect(bookingRepositoryMock.update).toHaveBeenNthCalledWith(
      1,
      { id: 10 },
      { worker_id: 2 },
      { transaction: 'mock-savepoint' }
    );
    expect(bookingRepositoryMock.update).toHaveBeenNthCalledWith(
      2,
      { id: 10 },
      { worker_id: 3 },
      { transaction: 'mock-savepoint' }
    );
    expect(result).toEqual([{ booking_id: 10, new_worker_id: 3 }]);
  });

  it('throws WORKER_UNAVAILABLE when every candidate loses the race', async () => {
    bookingRepositoryMock.listReassignableForWorker.mockResolvedValue([
      {
        id: 10,
        worker_id: 1,
        start_time: new Date('2026-07-14T09:00:00+07:00'),
        end_time: new Date('2026-07-14T09:30:00+07:00'),
      },
    ]);
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    workerRepositoryMock.getAvailability.mockResolvedValue([{ worker_id: 2, has_overlap: false, booked_hours: 0 }]);
    bookingAvailabilityServiceMock.isWorkerFree.mockResolvedValue(true);
    bookingRepositoryMock.update.mockRejectedValue(new ExclusionConstraintError({ message: 'conflicting key value' }));

    await expect(service.reassignBookingsFromWorker(1, { transaction: 'tx' })).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
    });
  });
});
