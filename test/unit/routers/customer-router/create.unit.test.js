import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const customerServiceMock = {
  register: jest.fn(),
};

class MockCustomerService {
  constructor() {
    return customerServiceMock;
  }
}

jest.unstable_mockModule('#services/customer.service', () => ({ CustomerService: MockCustomerService }));

const { buildApp } = await import('#src/index');
const { ConflictError } = await import('#configs/error');
const { ACCOUNT_ERROR_CODES } = await import('#constants/error-codes.const');

describe('POST /api/customers/create (router + controller)', () => {
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

  it('returns 201 with the created customer', async () => {
    const customer = { id: 1, name: 'Alice', email: 'alice@example.com', address: '1 Main St' };
    customerServiceMock.register.mockResolvedValue(customer);

    const payload = { name: 'Alice', email: 'alice@example.com', password: 'secret', address: '1 Main St' };
    const response = await app.inject({ method: 'POST', url: '/api/customers/create', payload });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ success: true, message: 'Customer registered', data: customer });
    expect(customerServiceMock.register).toHaveBeenCalledWith(payload);
  });

  it('returns 400 schema validation error when address is missing, without calling the service', async () => {
    const payload = { name: 'Alice', email: 'alice@example.com', password: 'secret' };
    const response = await app.inject({ method: 'POST', url: '/api/customers/create', payload });

    expect(response.statusCode).toBe(400);
    expect(customerServiceMock.register).not.toHaveBeenCalled();
  });

  it('returns 409 with EMAIL_ALREADY_REGISTERED when the service reports a duplicate email', async () => {
    customerServiceMock.register.mockRejectedValue(
      new ConflictError('Email already registered', { code: ACCOUNT_ERROR_CODES.EMAIL_ALREADY_REGISTERED })
    );

    const payload = { name: 'Alice', email: 'alice@example.com', password: 'secret', address: '1 Main St' };
    const response = await app.inject({ method: 'POST', url: '/api/customers/create', payload });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      success: false,
      message: 'Email already registered',
      code: ACCOUNT_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
    });
  });
});
