import { jest, describe, it, expect, beforeEach } from '@jest/globals';

process.env.BUSINESS_TZ = 'Asia/Ho_Chi_Minh';

const workerRepositoryMock = {
  pagination: jest.fn(),
};

const { WorkerService } = await import('#services/worker.service');

describe('WorkerService.list', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(WorkerService.prototype);
    service.workerRepository = workerRepositoryMock;
  });

  it('returns a paginated worker roster ordered by id ascending', async () => {
    const paginated = { rows: [{ id: 1 }, { id: 2 }], count: 2, page: 1, limit: 20, totalPages: 1 };
    workerRepositoryMock.pagination.mockResolvedValue(paginated);

    const result = await service.list();

    expect(workerRepositoryMock.pagination).toHaveBeenCalledWith({
      order: [['id', 'ASC']],
      page: undefined,
      limit: undefined,
    });
    expect(result).toBe(paginated);
  });

  it('passes page/limit through when given', async () => {
    workerRepositoryMock.pagination.mockResolvedValue({ rows: [], count: 0, page: 2, limit: 5, totalPages: 0 });

    await service.list({ page: 2, limit: 5 });

    expect(workerRepositoryMock.pagination).toHaveBeenCalledWith({
      order: [['id', 'ASC']],
      page: 2,
      limit: 5,
    });
  });
});
