import { jest, describe, it, expect, beforeEach } from '@jest/globals';

process.env.BUSINESS_TZ = 'Asia/Ho_Chi_Minh';

const workerRepositoryMock = {
  create: jest.fn(),
};

const { WorkerService } = await import('#services/worker.service');

describe('WorkerService.register', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(WorkerService.prototype);
    service.workerRepository = workerRepositoryMock;
  });

  it('creates a worker with the given name', async () => {
    const created = { id: 1, name: 'Alice', is_active: true };
    workerRepositoryMock.create.mockResolvedValue(created);

    const result = await service.register({ name: 'Alice' });

    expect(workerRepositoryMock.create).toHaveBeenCalledWith({ name: 'Alice' });
    expect(result).toBe(created);
  });
});
