import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const customerServiceMock = {
  register: jest.fn(),
  list: jest.fn(),
};

class MockCustomerService {
  constructor() {
    return customerServiceMock;
  }
}

jest.unstable_mockModule('#services/customer.service', () => ({ CustomerService: MockCustomerService }));

const { buildApp } = await import('#src/index');

describe('POST /api/customers (router + controller)', () => {
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

  it('returns 201 with the registered customer', async () => {
    const customer = { id: 1, name: 'Alice' };
    customerServiceMock.register.mockResolvedValue(customer);

    const response = await app.inject({ method: 'POST', url: '/api/customers', payload: { name: 'Alice' } });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ success: true, message: 'Customer registered', data: customer });
    expect(customerServiceMock.register).toHaveBeenCalledWith({ name: 'Alice' });
  });

  it('returns 400 schema validation error when name is missing, without calling the service', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/customers', payload: {} });

    expect(response.statusCode).toBe(400);
    expect(customerServiceMock.register).not.toHaveBeenCalled();
  });
});
