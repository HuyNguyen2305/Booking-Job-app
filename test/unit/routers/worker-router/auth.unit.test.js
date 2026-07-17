import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const workerServiceMock = {
  listAvailable: jest.fn(),
  register: jest.fn(),
  selfRegister: jest.fn(),
  list: jest.fn(),
  getById: jest.fn(),
  updateStatus: jest.fn(),
};

class MockWorkerService {
  constructor() {
    return workerServiceMock;
  }
}

jest.unstable_mockModule('#services/worker.service', () => ({ WorkerService: MockWorkerService }));

const { buildApp } = await import('#src/index');
const { signToken } = await import('#src/common/auth/jwt.util');
const { ROLES } = await import('#constants/role.const');

describe('Worker router auth enforcement (NODE_ENV=production)', () => {
  let app;
  let adminToken;
  let workerToken;
  let customerToken;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret';
    app = await buildApp({ logger: false });
    await app.ready();

    adminToken = signToken({ id: 1, role: ROLES.ADMIN });
    workerToken = signToken({ id: 2, role: ROLES.WORKER });
    customerToken = signToken({ id: 5, role: ROLES.CUSTOMER });
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalSecret;
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/workers returns 401 without a bearer token', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/workers' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/workers returns 403 for CUSTOMER (admin-only)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/workers',
      headers: { authorization: `Bearer ${customerToken}` },
    });
    expect(response.statusCode).toBe(403);
    expect(workerServiceMock.list).not.toHaveBeenCalled();
  });

  it('GET /api/workers returns 200 for ADMIN', async () => {
    workerServiceMock.list.mockResolvedValue({ rows: [], count: 0, page: 1, limit: 20, totalPages: 0 });

    const response = await app.inject({
      method: 'GET',
      url: '/api/workers',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('POST /api/workers returns 403 for WORKER (admin-only onboarding)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/workers',
      headers: { authorization: `Bearer ${workerToken}` },
      payload: { name: 'New Guy', email: 'new@example.com', password: 'secret' },
    });

    expect(response.statusCode).toBe(403);
    expect(workerServiceMock.register).not.toHaveBeenCalled();
  });

  it('POST /api/workers/register returns 201 without a bearer token (public self-signup)', async () => {
    workerServiceMock.selfRegister.mockResolvedValue({ id: 3, name: 'New Guy', email: 'new@example.com', is_active: false });

    const response = await app.inject({
      method: 'POST',
      url: '/api/workers/register',
      payload: { name: 'New Guy', email: 'new@example.com', password: 'secret' },
    });

    expect(response.statusCode).toBe(201);
    expect(workerServiceMock.selfRegister).toHaveBeenCalled();
  });

  it('GET /api/workers/available returns 200 for CUSTOMER', async () => {
    workerServiceMock.listAvailable.mockResolvedValue([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/workers/available?start=2026-08-03T02:00:00.000Z&end=2026-08-03T04:00:00.000Z',
      headers: { authorization: `Bearer ${customerToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('GET /api/workers/:id returns 200 when the WORKER id matches the token', async () => {
    workerServiceMock.getById.mockResolvedValue({ id: 2, name: 'Alice' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/workers/2',
      headers: { authorization: `Bearer ${workerToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('GET /api/workers/:id returns 403 when the WORKER id does not match the token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/workers/999',
      headers: { authorization: `Bearer ${workerToken}` },
    });

    expect(response.statusCode).toBe(403);
    expect(workerServiceMock.getById).not.toHaveBeenCalled();
  });
});
