import { jest, describe, it, expect, beforeEach } from '@jest/globals';

process.env.BUSINESS_TZ = 'Asia/Ho_Chi_Minh';

const workerRepositoryMock = {
  getOne: jest.fn(),
  getHoursThisWeek: jest.fn(),
};

const { WorkerService } = await import('#services/worker.service');
const { NotFoundError } = await import('#configs/error');
const { WEEKLY_HOURS_CAP } = await import('#constants/business-hours.const');

describe('WorkerService.getById', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(WorkerService.prototype);
    service.workerRepository = workerRepositoryMock;
  });

  it('throws NotFoundError when the worker does not exist', async () => {
    workerRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.getById(999)).rejects.toBeInstanceOf(NotFoundError);
    expect(workerRepositoryMock.getHoursThisWeek).not.toHaveBeenCalled();
  });

  it('merges worker identity (including its stored total_hours) with the live hours_this_week figure', async () => {
    const worker = { toJSON: () => ({ id: 1, name: 'Alice', is_active: true, total_hours: 340 }) };
    workerRepositoryMock.getOne.mockResolvedValue(worker);
    workerRepositoryMock.getHoursThisWeek.mockResolvedValue(12);

    const result = await service.getById(1);

    expect(workerRepositoryMock.getOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(workerRepositoryMock.getHoursThisWeek).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ weekStart: expect.any(Date), weekEnd: expect.any(Date) })
    );
    expect(result).toEqual({
      id: 1,
      name: 'Alice',
      is_active: true,
      total_hours: 340,
      hours_this_week: 12,
      weekly_hours_cap: WEEKLY_HOURS_CAP,
    });
  });
});
