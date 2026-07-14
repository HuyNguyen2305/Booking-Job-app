import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const customerRepositoryMock = {
  get: jest.fn(),
};

const { CustomerService } = await import('#services/customer.service');

describe('CustomerService.list', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(CustomerService.prototype);
    service.customerRepository = customerRepositoryMock;
  });

  it('returns the full customer roster ordered by id ascending', async () => {
    const customers = [{ id: 1 }, { id: 2 }];
    customerRepositoryMock.get.mockResolvedValue(customers);

    const result = await service.list();

    expect(customerRepositoryMock.get).toHaveBeenCalledWith({ order: [['id', 'ASC']] });
    expect(result).toBe(customers);
  });
});
