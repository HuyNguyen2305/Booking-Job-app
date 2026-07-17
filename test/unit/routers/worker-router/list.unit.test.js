import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const workerServiceMock = {
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

describe('GET /api/workers (router + controller)', () => {
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

  it('returns 200 with a paginated worker roster', async () => {
    const paginated = { rows: [{ id: 1, name: 'Alice' }], count: 1, page: 1, limit: 20, totalPages: 1 };
    workerServiceMock.list.mockResolvedValue(paginated);

    const response = await app.inject({ method: 'GET', url: '/api/workers' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Workers retrieved', data: paginated });
  });

  it('passes page/limit querystring params through to the service', async () => {
    workerServiceMock.list.mockResolvedValue({ rows: [], count: 0, page: 2, limit: 5, totalPages: 0 });

    await app.inject({ method: 'GET', url: '/api/workers?page=2&limit=5' });

    expect(workerServiceMock.list).toHaveBeenCalledWith({ page: 2, limit: 5 });
  });

  it('returns 400 schema validation error when limit exceeds the maximum, without calling the service', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/workers?limit=101' });

    expect(response.statusCode).toBe(400);
    expect(workerServiceMock.list).not.toHaveBeenCalled();
  });

  it('passes name/email/is_active querystring filters through to the service', async () => {
    workerServiceMock.list.mockResolvedValue({ rows: [], count: 0, page: 1, limit: 20, totalPages: 0 });

    await app.inject({ method: 'GET', url: '/api/workers?name=ali&email=example.com&is_active=false' });

    expect(workerServiceMock.list).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ali', email: 'example.com', is_active: false })
    );
  });

  it('returns 400 schema validation error when is_active is not a boolean, without calling the service', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/workers?is_active=maybe' });

    expect(response.statusCode).toBe(400);
    expect(workerServiceMock.list).not.toHaveBeenCalled();
  });
});
