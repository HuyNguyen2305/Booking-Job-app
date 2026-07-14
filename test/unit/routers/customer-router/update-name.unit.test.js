import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const customerServiceMock = {
  updateName: jest.fn(),
};

class MockCustomerService {
  constructor() {
    return customerServiceMock;
  }
}

jest.unstable_mockModule('#services/customer.service', () => ({ CustomerService: MockCustomerService }));

const { buildApp } = await import('#src/index');
const { NotFoundError } = await import('#configs/error');

describe('PATCH /api/customers/:id (router + controller + error handler)', () => {
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

  it('returns 200 with the updated customer', async () => {
    const customer = { id: 1, name: 'Bob' };
    customerServiceMock.updateName.mockResolvedValue(customer);

    const response = await app.inject({ method: 'PATCH', url: '/api/customers/1', payload: { name: 'Bob' } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Customer updated', data: customer });
    expect(customerServiceMock.updateName).toHaveBeenCalledWith(1, 'Bob');
  });

  it('returns 404 in the custom error shape when the customer does not exist', async () => {
    customerServiceMock.updateName.mockRejectedValue(new NotFoundError('Customer not found'));

    const response = await app.inject({ method: 'PATCH', url: '/api/customers/999', payload: { name: 'Bob' } });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ success: false, message: 'Customer not found' });
  });

  it('returns 400 schema validation error when name is missing, without calling the service', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/api/customers/1', payload: {} });

    expect(response.statusCode).toBe(400);
    expect(customerServiceMock.updateName).not.toHaveBeenCalled();
  });

  it('returns 400 schema validation error for a non-integer id param, without calling the service', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/api/customers/not-a-number', payload: { name: 'Bob' } });

    expect(response.statusCode).toBe(400);
    expect(customerServiceMock.updateName).not.toHaveBeenCalled();
  });
});
