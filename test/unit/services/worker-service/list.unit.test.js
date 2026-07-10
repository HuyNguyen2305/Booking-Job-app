import { jest, describe, it, expect, beforeEach } from '@jest/globals';

process.env.BUSINESS_TZ = 'Asia/Ho_Chi_Minh';

const workerRepositoryMock = {
  get: jest.fn(),
};

const { WorkerService } = await import('#services/worker.service');

describe('WorkerService.list', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(WorkerService.prototype);
    service.workerRepository = workerRepositoryMock;
  });

  it('returns the full worker roster ordered by id ascending', async () => {
    const workers = [{ id: 1 }, { id: 2 }];
    workerRepositoryMock.get.mockResolvedValue(workers);

    const result = await service.list();

    expect(workerRepositoryMock.get).toHaveBeenCalledWith({ order: [['id', 'ASC']] });
    expect(result).toBe(workers);
  });
});
