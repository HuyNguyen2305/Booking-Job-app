import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const customerRepositoryMock = {
  create: jest.fn(),
};

const passwordUtilMock = { hashPassword: jest.fn() };
jest.unstable_mockModule('#src/common/auth/password.util', () => passwordUtilMock);

const { CustomerService } = await import('#services/customer.service');

describe('CustomerService.register', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(CustomerService.prototype);
    service.customerRepository = customerRepositoryMock;
  });

  it('hashes the password and creates a customer with the given name/email', async () => {
    const created = { id: 1, name: 'Alice', email: 'alice@example.com' };
    passwordUtilMock.hashPassword.mockResolvedValue('hashed-secret');
    customerRepositoryMock.create.mockResolvedValue(created);

    const result = await service.register({ name: 'Alice', email: 'alice@example.com', password: 'secret' });

    expect(passwordUtilMock.hashPassword).toHaveBeenCalledWith('secret');
    expect(customerRepositoryMock.create).toHaveBeenCalledWith({
      name: 'Alice',
      email: 'alice@example.com',
      password_hash: 'hashed-secret',
    });
    expect(result).toBe(created);
  });
});
