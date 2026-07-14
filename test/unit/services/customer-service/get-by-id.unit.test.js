import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const customerRepositoryMock = {
  getOne: jest.fn(),
};

const { CustomerService } = await import('#services/customer.service');
const { NotFoundError } = await import('#configs/error');

describe('CustomerService.getById', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(CustomerService.prototype);
    service.customerRepository = customerRepositoryMock;
  });

  it('returns the customer when it exists', async () => {
    const customer = { id: 1, name: 'Alice' };
    customerRepositoryMock.getOne.mockResolvedValue(customer);

    const result = await service.getById(1);

    expect(customerRepositoryMock.getOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toBe(customer);
  });

  it('throws NotFoundError when the customer does not exist', async () => {
    customerRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.getById(999)).rejects.toBeInstanceOf(NotFoundError);
  });
});
