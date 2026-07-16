import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const authServiceMock = {
  loginAdmin: jest.fn(),
  loginWorker: jest.fn(),
  loginCustomer: jest.fn(),
};

class MockAuthService {
  constructor() {
    return authServiceMock;
  }
}

jest.unstable_mockModule('#services/auth.service', () => ({ AuthService: MockAuthService }));

const { buildApp } = await import('#src/index');

describe('POST /api/auth/admin/login (router + controller)', () => {
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

  it('returns 200 with the token and admin profile on success', async () => {
    const result = { token: 'signed-token', admin: { id: 1, name: 'Root', email: 'root@example.com' } };
    authServiceMock.loginAdmin.mockResolvedValue(result);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/admin/login',
      payload: { email: 'root@example.com', password: 'secret' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Login successful', data: result });
    expect(authServiceMock.loginAdmin).toHaveBeenCalledWith('root@example.com', 'secret');
  });

  it('returns 400 schema validation error when email/password is missing, without calling the service', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/auth/admin/login', payload: {} });

    expect(response.statusCode).toBe(400);
    expect(authServiceMock.loginAdmin).not.toHaveBeenCalled();
  });

  it('propagates a 401 in the custom error shape for invalid credentials', async () => {
    const { UnauthorizedError } = await import('#configs/error');
    authServiceMock.loginAdmin.mockRejectedValue(new UnauthorizedError('Invalid email or password'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/admin/login',
      payload: { email: 'root@example.com', password: 'wrong' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ success: false, message: 'Invalid email or password' });
  });
});
