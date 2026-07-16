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

describe('GET /api/customers (router + controller)', () => {
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

  it('returns 200 with a paginated customer roster', async () => {
    const paginated = { rows: [{ id: 1, name: 'Alice' }], count: 1, page: 1, limit: 20, totalPages: 1 };
    customerServiceMock.list.mockResolvedValue(paginated);

    const response = await app.inject({ method: 'GET', url: '/api/customers' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Customers retrieved', data: paginated });
  });

  it('passes page/limit querystring params through to the service', async () => {
    customerServiceMock.list.mockResolvedValue({ rows: [], count: 0, page: 2, limit: 5, totalPages: 0 });

    await app.inject({ method: 'GET', url: '/api/customers?page=2&limit=5' });

    expect(customerServiceMock.list).toHaveBeenCalledWith({ page: 2, limit: 5 });
  });
});
