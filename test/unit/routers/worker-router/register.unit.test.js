import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const workerServiceMock = {
  listAvailable: jest.fn(),
  register: jest.fn(),
  list: jest.fn(),
};

class MockWorkerService {
  constructor() {
    return workerServiceMock;
  }
}

jest.unstable_mockModule('#services/worker.service', () => ({ WorkerService: MockWorkerService }));

const { buildApp } = await import('#src/index');

describe('POST /api/workers and GET /api/workers (router + controller)', () => {
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

  it('POST /api/workers returns 201 with the registered worker', async () => {
    const worker = { id: 1, name: 'Alice', is_active: true };
    workerServiceMock.register.mockResolvedValue(worker);

    const response = await app.inject({ method: 'POST', url: '/api/workers', payload: { name: 'Alice' } });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ success: true, message: 'Worker registered', data: worker });
  });

  it('POST /api/workers returns 400 schema validation error when name is missing', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/workers', payload: {} });

    expect(response.statusCode).toBe(400);
    expect(workerServiceMock.register).not.toHaveBeenCalled();
  });

  it('GET /api/workers returns 200 with the full roster', async () => {
    const workers = [{ id: 1, name: 'Alice', is_active: true }];
    workerServiceMock.list.mockResolvedValue(workers);

    const response = await app.inject({ method: 'GET', url: '/api/workers' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Workers retrieved', data: workers });
  });
});
