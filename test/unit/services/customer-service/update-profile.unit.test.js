import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const customerRepositoryMock = {
  getOne: jest.fn(),
  update: jest.fn(),
};

const { CustomerService } = await import('#services/customer.service');
const { NotFoundError } = await import('#configs/error');

describe('CustomerService.updateProfile', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(CustomerService.prototype);
    service.customerRepository = customerRepositoryMock;
  });

  it('throws NotFoundError when the customer does not exist', async () => {
    customerRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.updateProfile(999, { name: 'Bob' })).rejects.toBeInstanceOf(NotFoundError);
    expect(customerRepositoryMock.update).not.toHaveBeenCalled();
  });

  it('updates the name of an existing customer', async () => {
    customerRepositoryMock.getOne.mockResolvedValue({ id: 1, name: 'Alice' });
    const updated = { id: 1, name: 'Bob' };
    customerRepositoryMock.update.mockResolvedValue(updated);

    const result = await service.updateProfile(1, { name: 'Bob' });

    expect(customerRepositoryMock.update).toHaveBeenCalledWith({ id: 1 }, { name: 'Bob' });
    expect(result).toBe(updated);
  });

  it('updates the name and address together when both are given', async () => {
    customerRepositoryMock.getOne.mockResolvedValue({ id: 1, name: 'Alice', address: '1 Old St' });
    const updated = { id: 1, name: 'Bob', address: '2 New St' };
    customerRepositoryMock.update.mockResolvedValue(updated);

    const result = await service.updateProfile(1, { name: 'Bob', address: '2 New St' });

    expect(customerRepositoryMock.update).toHaveBeenCalledWith({ id: 1 }, { name: 'Bob', address: '2 New St' });
    expect(result).toBe(updated);
  });
});
