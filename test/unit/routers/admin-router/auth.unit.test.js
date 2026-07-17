import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const adminServiceMock = {
  create: jest.fn(),
  list: jest.fn(),
  getById: jest.fn(),
  updateStatus: jest.fn(),
};

class MockAdminService {
  constructor() {
    return adminServiceMock;
  }
}

jest.unstable_mockModule('#services/admin.service', () => ({ AdminService: MockAdminService }));

const { buildApp } = await import('#src/index');
const { signToken } = await import('#src/common/auth/jwt.util');
const { ROLES } = await import('#constants/role.const');

describe('Admin router auth enforcement (NODE_ENV=production)', () => {
  let app;
  let adminToken;
  let otherAdminToken;
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
    otherAdminToken = signToken({ id: 2, role: ROLES.ADMIN });
    workerToken = signToken({ id: 3, role: ROLES.WORKER });
    customerToken = signToken({ id: 4, role: ROLES.CUSTOMER });
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalSecret;
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/admins returns 401 without a bearer token', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/admins' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/admins returns 403 for WORKER', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admins',
      headers: { authorization: `Bearer ${workerToken}` },
    });
    expect(response.statusCode).toBe(403);
    expect(adminServiceMock.list).not.toHaveBeenCalled();
  });

  it('GET /api/admins returns 403 for CUSTOMER', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admins',
      headers: { authorization: `Bearer ${customerToken}` },
    });
    expect(response.statusCode).toBe(403);
    expect(adminServiceMock.list).not.toHaveBeenCalled();
  });

  it('GET /api/admins returns 200 for ADMIN', async () => {
    adminServiceMock.list.mockResolvedValue({ rows: [], count: 0, page: 1, limit: 20, totalPages: 0 });

    const response = await app.inject({
      method: 'GET',
      url: '/api/admins',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('POST /api/admins returns 403 for WORKER', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admins',
      headers: { authorization: `Bearer ${workerToken}` },
      payload: { name: 'New Admin', email: 'new-admin@example.com', password: 'secret' },
    });

    expect(response.statusCode).toBe(403);
    expect(adminServiceMock.create).not.toHaveBeenCalled();
  });

  it('POST /api/admins returns 201 for ADMIN', async () => {
    const created = { id: 5, name: 'New Admin', email: 'new-admin@example.com', is_active: true };
    adminServiceMock.create.mockResolvedValue(created);

    const response = await app.inject({
      method: 'POST',
      url: '/api/admins',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'New Admin', email: 'new-admin@example.com', password: 'secret' },
    });

    expect(response.statusCode).toBe(201);
  });

  it('GET /api/admins/:id returns 403 for CUSTOMER', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admins/1',
      headers: { authorization: `Bearer ${customerToken}` },
    });
    expect(response.statusCode).toBe(403);
    expect(adminServiceMock.getById).not.toHaveBeenCalled();
  });

  it('PATCH /api/admins/:id returns 403 for WORKER', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/admins/2',
      headers: { authorization: `Bearer ${workerToken}` },
      payload: { is_active: false },
    });
    expect(response.statusCode).toBe(403);
    expect(adminServiceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('PATCH /api/admins/:id returns 400 when an ADMIN tries to deactivate their own account', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/admins/1', // matches adminToken's own id
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { is_active: false },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ success: false, message: 'Cannot deactivate your own admin account' });
    expect(adminServiceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('PATCH /api/admins/:id allows an ADMIN to deactivate a different admin', async () => {
    const updated = { id: 2, name: 'Other Admin', is_active: false };
    adminServiceMock.updateStatus.mockResolvedValue(updated);

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/admins/2',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { is_active: false },
    });

    expect(response.statusCode).toBe(200);
    expect(adminServiceMock.updateStatus).toHaveBeenCalledWith(2, false);
  });

  it('PATCH /api/admins/:id allows an ADMIN to reactivate their own account (guard only blocks self-deactivation)', async () => {
    const updated = { id: 1, name: 'Root', is_active: true };
    adminServiceMock.updateStatus.mockResolvedValue(updated);

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/admins/1',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { is_active: true },
    });

    expect(response.statusCode).toBe(200);
    expect(adminServiceMock.updateStatus).toHaveBeenCalledWith(1, true);
  });

  it('two different ADMIN accounts can each deactivate the other', async () => {
    adminServiceMock.updateStatus.mockResolvedValue({ id: 1, is_active: false });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/admins/1',
      headers: { authorization: `Bearer ${otherAdminToken}` }, // id 2, targeting admin 1
      payload: { is_active: false },
    });

    expect(response.statusCode).toBe(200);
    expect(adminServiceMock.updateStatus).toHaveBeenCalledWith(1, false);
  });
});
