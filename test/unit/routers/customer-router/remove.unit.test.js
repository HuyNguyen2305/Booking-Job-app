import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const customerServiceMock = {
  remove: jest.fn(),
};

class MockCustomerService {
  constructor() {
    return customerServiceMock;
  }
}

jest.unstable_mockModule('#services/customer.service', () => ({ CustomerService: MockCustomerService }));

const { buildApp } = await import('#src/index');
const { NotFoundError } = await import('#configs/error');

describe('DELETE /api/customers/:id (router + controller + error handler)', () => {
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

  it('returns 200 with the deactivated customer and booking cancellation summary', async () => {
    const result = {
      id: 1,
      name: 'Alice',
      is_active: false,
      cancelled_booking_ids: [10],
      skipped_booking_ids: [],
    };
    customerServiceMock.remove.mockResolvedValue(result);

    const response = await app.inject({ method: 'DELETE', url: '/api/customers/1' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Customer deleted', data: result });
    expect(customerServiceMock.remove).toHaveBeenCalledWith(1);
  });

  it('returns 404 in the custom error shape when the customer does not exist', async () => {
    customerServiceMock.remove.mockRejectedValue(new NotFoundError('Customer not found'));

    const response = await app.inject({ method: 'DELETE', url: '/api/customers/999' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ success: false, message: 'Customer not found' });
  });

  it('returns 400 schema validation error for a non-integer id param, without calling the service', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/api/customers/not-a-number' });

    expect(response.statusCode).toBe(400);
    expect(customerServiceMock.remove).not.toHaveBeenCalled();
  });
});
