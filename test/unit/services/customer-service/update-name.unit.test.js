import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const customerRepositoryMock = {
  getOne: jest.fn(),
  update: jest.fn(),
};

const { CustomerService } = await import('#services/customer.service');
const { NotFoundError } = await import('#configs/error');

describe('CustomerService.updateName', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(CustomerService.prototype);
    service.customerRepository = customerRepositoryMock;
  });

  it('throws NotFoundError when the customer does not exist', async () => {
    customerRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.updateName(999, 'Bob')).rejects.toBeInstanceOf(NotFoundError);
    expect(customerRepositoryMock.update).not.toHaveBeenCalled();
  });

  it('updates the name of an existing customer', async () => {
    customerRepositoryMock.getOne.mockResolvedValue({ id: 1, name: 'Alice' });
    const updated = { id: 1, name: 'Bob' };
    customerRepositoryMock.update.mockResolvedValue(updated);

    const result = await service.updateName(1, 'Bob');

    expect(customerRepositoryMock.update).toHaveBeenCalledWith({ id: 1 }, { name: 'Bob' });
    expect(result).toBe(updated);
  });
});
