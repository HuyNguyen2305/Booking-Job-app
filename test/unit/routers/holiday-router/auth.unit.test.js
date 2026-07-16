import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const holidayServiceMock = {
  create: jest.fn(),
  createRange: jest.fn(),
  list: jest.fn(),
  remove: jest.fn(),
};

class MockHolidayService {
  constructor() {
    return holidayServiceMock;
  }
}

jest.unstable_mockModule('#services/holiday.service', () => ({ HolidayService: MockHolidayService }));

const { buildApp } = await import('#src/index');
const { signToken } = await import('#src/common/auth/jwt.util');
const { ROLES } = await import('#constants/role.const');

describe('Holiday router auth enforcement (NODE_ENV=production)', () => {
  let app;
  let adminToken;
  let workerToken;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret';
    app = await buildApp({ logger: false });
    await app.ready();

    adminToken = signToken({ id: 1, role: ROLES.ADMIN });
    workerToken = signToken({ id: 2, role: ROLES.WORKER });
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalSecret;
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/holidays returns 401 without a bearer token', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/holidays' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/holidays returns 200 for any authenticated role (WORKER)', async () => {
    holidayServiceMock.list.mockResolvedValue([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/holidays',
      headers: { authorization: `Bearer ${workerToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('POST /api/holidays returns 403 for WORKER (admin-only)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/holidays',
      headers: { authorization: `Bearer ${workerToken}` },
      payload: { holiday_date: '2026-09-02', name: 'Independence Day' },
    });

    expect(response.statusCode).toBe(403);
    expect(holidayServiceMock.create).not.toHaveBeenCalled();
  });

  it('POST /api/holidays returns 201 for ADMIN', async () => {
    holidayServiceMock.create.mockResolvedValue({ id: 'abc', holiday_date: '2026-09-02', name: 'Independence Day' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/holidays',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { holiday_date: '2026-09-02', name: 'Independence Day' },
    });

    expect(response.statusCode).toBe(201);
  });

  it('DELETE /api/holidays/:id returns 403 for WORKER (admin-only)', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/holidays/11111111-1111-1111-1111-111111111111',
      headers: { authorization: `Bearer ${workerToken}` },
    });

    expect(response.statusCode).toBe(403);
    expect(holidayServiceMock.remove).not.toHaveBeenCalled();
  });
});
