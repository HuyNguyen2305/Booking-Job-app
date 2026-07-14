import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const workerServiceMock = {
  getById: jest.fn(),
};

class MockWorkerService {
  constructor() {
    return workerServiceMock;
  }
}

jest.unstable_mockModule('#services/worker.service', () => ({ WorkerService: MockWorkerService }));

const { buildApp } = await import('#src/index');
const { NotFoundError } = await import('#configs/error');

describe('GET /api/workers/:id (router + controller + error handler)', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with the worker detail and stats from the service', async () => {
    const worker = {
      id: 1,
      name: 'Alice',
      is_active: true,
      hours_this_week: 12,
      weekly_hours_cap: 40,
      total_hours: 340,
    };
    workerServiceMock.getById.mockResolvedValue(worker);

    const response = await app.inject({ method: 'GET', url: '/api/workers/1' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Worker retrieved', data: worker });
    expect(workerServiceMock.getById).toHaveBeenCalledWith(1);
  });

  it('returns 404 in the custom error shape when the worker does not exist', async () => {
    workerServiceMock.getById.mockRejectedValue(new NotFoundError('Worker not found'));

    const response = await app.inject({ method: 'GET', url: '/api/workers/999' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ success: false, message: 'Worker not found' });
  });

  it('returns 400 schema validation error for a non-integer id param, without calling the service', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/workers/not-a-number' });

    expect(response.statusCode).toBe(400);
    expect(workerServiceMock.getById).not.toHaveBeenCalled();
  });
});
