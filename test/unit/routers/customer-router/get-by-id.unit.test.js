import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const customerServiceMock = {
  getById: jest.fn(),
};

class MockCustomerService {
  constructor() {
    return customerServiceMock;
  }
}

jest.unstable_mockModule('#services/customer.service', () => ({ CustomerService: MockCustomerService }));

const { buildApp } = await import('#src/index');
const { NotFoundError } = await import('#configs/error');

describe('GET /api/customers/:id (router + controller + error handler)', () => {
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

  it('returns 200 with the customer from the service', async () => {
    const customer = { id: 1, name: 'Alice' };
    customerServiceMock.getById.mockResolvedValue(customer);

    const response = await app.inject({ method: 'GET', url: '/api/customers/1' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Customer retrieved', data: customer });
    expect(customerServiceMock.getById).toHaveBeenCalledWith(1);
  });

  it('returns 404 in the custom error shape when the customer does not exist', async () => {
    customerServiceMock.getById.mockRejectedValue(new NotFoundError('Customer not found'));

    const response = await app.inject({ method: 'GET', url: '/api/customers/999' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ success: false, message: 'Customer not found' });
  });

  it('returns 400 schema validation error for a non-integer id param, without calling the service', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/customers/not-a-number' });

    expect(response.statusCode).toBe(400);
    expect(customerServiceMock.getById).not.toHaveBeenCalled();
  });
});
