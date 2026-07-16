import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const customerServiceMock = {
  register: jest.fn(),
  list: jest.fn(),
  getById: jest.fn(),
  updateName: jest.fn(),
  remove: jest.fn(),
};

class MockCustomerService {
  constructor() {
    return customerServiceMock;
  }
}

jest.unstable_mockModule('#services/customer.service', () => ({ CustomerService: MockCustomerService }));

const { buildApp } = await import('#src/index');
const { signToken } = await import('#src/common/auth/jwt.util');
const { ROLES } = await import('#constants/role.const');

describe('Customer router auth enforcement (NODE_ENV=production)', () => {
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

  it('GET /api/customers returns 401 without a bearer token', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/customers' });
    expect(response.statusCode).toBe(401);
    expect(customerServiceMock.list).not.toHaveBeenCalled();
  });

  it('GET /api/customers returns 403 for a non-admin role', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/customers',
      headers: { authorization: `Bearer ${workerToken}` },
    });
    expect(response.statusCode).toBe(403);
    expect(customerServiceMock.list).not.toHaveBeenCalled();
  });

  it('GET /api/customers returns 200 for ADMIN', async () => {
    customerServiceMock.list.mockResolvedValue({ rows: [], count: 0, page: 1, limit: 20, totalPages: 0 });

    const response = await app.inject({
      method: 'GET',
      url: '/api/customers',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(customerServiceMock.list).toHaveBeenCalled();
  });

  it('GET /api/customers/:id returns 200 when the CUSTOMER id matches the token', async () => {
    customerServiceMock.getById.mockResolvedValue({ id: 5, name: 'Bob' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/customers/5',
      headers: { authorization: `Bearer ${customerToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('GET /api/customers/:id returns 403 when the CUSTOMER id does not match the token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/customers/999',
      headers: { authorization: `Bearer ${customerToken}` },
    });

    expect(response.statusCode).toBe(403);
    expect(customerServiceMock.getById).not.toHaveBeenCalled();
  });

  it('DELETE /api/customers/:id returns 403 for a CUSTOMER (admin-only)', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/customers/5',
      headers: { authorization: `Bearer ${customerToken}` },
    });

    expect(response.statusCode).toBe(403);
    expect(customerServiceMock.remove).not.toHaveBeenCalled();
  });
});
