import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const adminServiceMock = {
  create: jest.fn(),
};

class MockAdminService {
  constructor() {
    return adminServiceMock;
  }
}

jest.unstable_mockModule('#services/admin.service', () => ({ AdminService: MockAdminService }));

const { buildApp } = await import('#src/index');
const { ConflictError } = await import('#configs/error');
const { ACCOUNT_ERROR_CODES } = await import('#constants/error-codes.const');

describe('POST /api/admins (router + controller)', () => {
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

  it('returns 201 with the created admin', async () => {
    const admin = { id: 2, name: 'Second Admin', email: 'second@example.com', is_active: true };
    adminServiceMock.create.mockResolvedValue(admin);

    const payload = { name: 'Second Admin', email: 'second@example.com', password: 'secret' };
    const response = await app.inject({ method: 'POST', url: '/api/admins', payload });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ success: true, message: 'Admin created', data: admin });
    expect(adminServiceMock.create).toHaveBeenCalledWith(payload);
  });

  it('returns 400 schema validation error when name/email/password is missing', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/admins', payload: {} });

    expect(response.statusCode).toBe(400);
    expect(adminServiceMock.create).not.toHaveBeenCalled();
  });

  it('returns 400 schema validation error when name/email exceeds 255 chars', async () => {
    const tooLong = 'a'.repeat(256);
    const payload = { name: tooLong, email: `${tooLong}@example.com`, password: 'secret' };
    const response = await app.inject({ method: 'POST', url: '/api/admins', payload });

    expect(response.statusCode).toBe(400);
    expect(adminServiceMock.create).not.toHaveBeenCalled();
  });

  it('returns 409 with EMAIL_ALREADY_REGISTERED when the service reports a duplicate email', async () => {
    adminServiceMock.create.mockRejectedValue(
      new ConflictError('Email already registered', { code: ACCOUNT_ERROR_CODES.EMAIL_ALREADY_REGISTERED })
    );

    const payload = { name: 'Second Admin', email: 'second@example.com', password: 'secret' };
    const response = await app.inject({ method: 'POST', url: '/api/admins', payload });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      success: false,
      message: 'Email already registered',
      code: ACCOUNT_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
    });
  });
});
