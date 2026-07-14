import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const customerRepositoryMock = {
  create: jest.fn(),
};

const { CustomerService } = await import('#services/customer.service');

describe('CustomerService.register', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(CustomerService.prototype);
    service.customerRepository = customerRepositoryMock;
  });

  it('creates a customer with the given name', async () => {
    const created = { id: 1, name: 'Alice' };
    customerRepositoryMock.create.mockResolvedValue(created);

    const result = await service.register({ name: 'Alice' });

    expect(customerRepositoryMock.create).toHaveBeenCalledWith({ name: 'Alice' });
    expect(result).toBe(created);
  });
});
