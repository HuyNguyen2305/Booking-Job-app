import { jest, describe, it, expect, beforeEach } from '@jest/globals';

process.env.BUSINESS_TZ = 'Asia/Ho_Chi_Minh';

const workerRepositoryMock = {
  listActive: jest.fn(),
  getAvailability: jest.fn(),
};

const { WorkerService } = await import('#services/worker.service');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');

describe('WorkerService.listAvailable', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(WorkerService.prototype);
    service.workerRepository = workerRepositoryMock;
  });

  const validRange = { start: '2026-07-14T09:00:00+07:00', end: '2026-07-14T10:00:00+07:00' };

  it('throws ValidationError with INVALID_TIMESTAMP_FORMAT when start lacks a UTC offset', async () => {
    await expect(service.listAvailable({ start: '2026-07-14T09:00:00', end: validRange.end })).rejects.toMatchObject(
      { code: BOOKING_ERROR_CODES.INVALID_TIMESTAMP_FORMAT }
    );
  });

  it('excludes workers with an overlapping booking and sorts the rest ascending by booked hours', async () => {
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    workerRepositoryMock.getAvailability.mockResolvedValue([
      { worker_id: 1, has_overlap: false, booked_hours: 5 },
      { worker_id: 2, has_overlap: true, booked_hours: 0 },
      { worker_id: 3, has_overlap: false, booked_hours: 1 },
    ]);

    const result = await service.listAvailable(validRange);

    expect(result).toEqual([
      { worker_id: 3, booked_hours_that_day: 1 },
      { worker_id: 1, booked_hours_that_day: 5 },
    ]);
  });

  it('queries availability for exactly the active worker ids', async () => {
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 7 }, { id: 8 }]);
    workerRepositoryMock.getAvailability.mockResolvedValue([]);

    await service.listAvailable(validRange);

    expect(workerRepositoryMock.getAvailability).toHaveBeenCalledWith(
      [7, 8],
      expect.objectContaining({ start: validRange.start, end: validRange.end })
    );
  });
});
