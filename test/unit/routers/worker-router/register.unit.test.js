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
    const worker = { id: 1, name: 'Alice', email: 'alice@example.com', is_active: true };
    workerServiceMock.register.mockResolvedValue(worker);

    const payload = { name: 'Alice', email: 'alice@example.com', password: 'secret' };
    const response = await app.inject({ method: 'POST', url: '/api/workers', payload });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ success: true, message: 'Worker registered', data: worker });
  });

  it('POST /api/workers returns 400 schema validation error when name/email/password is missing', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/workers', payload: {} });

    expect(response.statusCode).toBe(400);
    expect(workerServiceMock.register).not.toHaveBeenCalled();
  });

  it('GET /api/workers returns 200 with a paginated roster', async () => {
    const paginated = { rows: [{ id: 1, name: 'Alice', is_active: true }], count: 1, page: 1, limit: 20, totalPages: 1 };
    workerServiceMock.list.mockResolvedValue(paginated);

    const response = await app.inject({ method: 'GET', url: '/api/workers' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Workers retrieved', data: paginated });
  });

  it('GET /api/workers passes page/limit querystring params through to the service', async () => {
    workerServiceMock.list.mockResolvedValue({ rows: [], count: 0, page: 2, limit: 5, totalPages: 0 });

    await app.inject({ method: 'GET', url: '/api/workers?page=2&limit=5' });

    expect(workerServiceMock.list).toHaveBeenCalledWith({ page: 2, limit: 5 });
  });
});
