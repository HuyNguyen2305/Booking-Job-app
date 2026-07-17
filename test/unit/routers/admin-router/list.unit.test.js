import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const adminServiceMock = {
  list: jest.fn(),
};

class MockAdminService {
  constructor() {
    return adminServiceMock;
  }
}

jest.unstable_mockModule('#services/admin.service', () => ({ AdminService: MockAdminService }));

const { buildApp } = await import('#src/index');

describe('GET /api/admins (router + controller)', () => {
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

  it('returns 200 with a paginated admin roster', async () => {
    const paginated = { rows: [{ id: 1, name: 'Root' }], count: 1, page: 1, limit: 20, totalPages: 1 };
    adminServiceMock.list.mockResolvedValue(paginated);

    const response = await app.inject({ method: 'GET', url: '/api/admins' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Admins retrieved', data: paginated });
  });

  it('passes page/limit querystring params through to the service', async () => {
    adminServiceMock.list.mockResolvedValue({ rows: [], count: 0, page: 2, limit: 5, totalPages: 0 });

    await app.inject({ method: 'GET', url: '/api/admins?page=2&limit=5' });

    expect(adminServiceMock.list).toHaveBeenCalledWith({ page: 2, limit: 5 });
  });

  it('returns 400 schema validation error when limit exceeds the maximum, without calling the service', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/admins?limit=101' });

    expect(response.statusCode).toBe(400);
    expect(adminServiceMock.list).not.toHaveBeenCalled();
  });

  it('passes name/email/is_active querystring filters through to the service', async () => {
    adminServiceMock.list.mockResolvedValue({ rows: [], count: 0, page: 1, limit: 20, totalPages: 0 });

    await app.inject({ method: 'GET', url: '/api/admins?name=root&email=example.com&is_active=true' });

    expect(adminServiceMock.list).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'root', email: 'example.com', is_active: true })
    );
  });

  it('returns 400 schema validation error when is_active is not a boolean, without calling the service', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/admins?is_active=maybe' });

    expect(response.statusCode).toBe(400);
    expect(adminServiceMock.list).not.toHaveBeenCalled();
  });
});
