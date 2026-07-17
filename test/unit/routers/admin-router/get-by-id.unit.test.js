import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const adminServiceMock = {
  getById: jest.fn(),
};

class MockAdminService {
  constructor() {
    return adminServiceMock;
  }
}

jest.unstable_mockModule('#services/admin.service', () => ({ AdminService: MockAdminService }));

const { buildApp } = await import('#src/index');
const { NotFoundError } = await import('#configs/error');

describe('GET /api/admins/:id (router + controller + error handler)', () => {
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

  it('returns 200 with the admin on success', async () => {
    const admin = { id: 1, name: 'Root', email: 'root@example.com', is_active: true };
    adminServiceMock.getById.mockResolvedValue(admin);

    const response = await app.inject({ method: 'GET', url: '/api/admins/1' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Admin retrieved', data: admin });
    expect(adminServiceMock.getById).toHaveBeenCalledWith(1);
  });

  it('returns 404 in the custom error shape when the admin does not exist', async () => {
    adminServiceMock.getById.mockRejectedValue(new NotFoundError('Admin not found'));

    const response = await app.inject({ method: 'GET', url: '/api/admins/999' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ success: false, message: 'Admin not found' });
  });
});
