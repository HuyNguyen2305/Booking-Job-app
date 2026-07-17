import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const adminServiceMock = {
  updateStatus: jest.fn(),
};

class MockAdminService {
  constructor() {
    return adminServiceMock;
  }
}

jest.unstable_mockModule('#services/admin.service', () => ({ AdminService: MockAdminService }));

const { buildApp } = await import('#src/index');
const { NotFoundError } = await import('#configs/error');

describe('PATCH /api/admins/:id (router + controller + error handler)', () => {
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

  it('returns 200 with the updated admin on success', async () => {
    const admin = { id: 2, name: 'Second Admin', is_active: false };
    adminServiceMock.updateStatus.mockResolvedValue(admin);

    const response = await app.inject({ method: 'PATCH', url: '/api/admins/2', payload: { is_active: false } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Admin status updated', data: admin });
    expect(adminServiceMock.updateStatus).toHaveBeenCalledWith(2, false);
  });

  it('returns 404 in the custom error shape when the admin does not exist', async () => {
    adminServiceMock.updateStatus.mockRejectedValue(new NotFoundError('Admin not found'));

    const response = await app.inject({ method: 'PATCH', url: '/api/admins/999', payload: { is_active: false } });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ success: false, message: 'Admin not found' });
  });

  it('returns 400 schema validation error when is_active is missing, without calling the service', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/api/admins/2', payload: {} });

    expect(response.statusCode).toBe(400);
    expect(adminServiceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('returns 400 schema validation error when is_active is not a boolean, without calling the service', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/api/admins/2', payload: { is_active: 'nope' } });

    expect(response.statusCode).toBe(400);
    expect(adminServiceMock.updateStatus).not.toHaveBeenCalled();
  });
});
