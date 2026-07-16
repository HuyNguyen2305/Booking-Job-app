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

describe('POST /api/auth/customer/login (router + controller)', () => {
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

  it('returns 200 with the token and customer profile on success', async () => {
    const result = { token: 'signed-token', customer: { id: 3, name: 'Bob', email: 'bob@example.com' } };
    authServiceMock.loginCustomer.mockResolvedValue(result);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/customer/login',
      payload: { email: 'bob@example.com', password: 'secret' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Login successful', data: result });
    expect(authServiceMock.loginCustomer).toHaveBeenCalledWith('bob@example.com', 'secret');
  });

  it('returns 400 schema validation error when email/password is missing, without calling the service', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/auth/customer/login', payload: {} });

    expect(response.statusCode).toBe(400);
    expect(authServiceMock.loginCustomer).not.toHaveBeenCalled();
  });
});
