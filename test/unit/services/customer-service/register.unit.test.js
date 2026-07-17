import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const customerRepositoryMock = {
  create: jest.fn(),
};

const passwordUtilMock = { hashPassword: jest.fn() };
jest.unstable_mockModule('#src/common/auth/password.util', () => passwordUtilMock);

const { CustomerService } = await import('#services/customer.service');
const { ConflictError } = await import('#configs/error');
const { ACCOUNT_ERROR_CODES } = await import('#constants/error-codes.const');

describe('CustomerService.register', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(CustomerService.prototype);
    service.customerRepository = customerRepositoryMock;
  });

  it('hashes the password and creates a customer with the given name/email/address', async () => {
    const created = { id: 1, name: 'Alice', email: 'alice@example.com', address: '1 Main St' };
    passwordUtilMock.hashPassword.mockResolvedValue('hashed-secret');
    customerRepositoryMock.create.mockResolvedValue(created);

    const result = await service.register({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'secret',
      address: '1 Main St',
    });

    expect(passwordUtilMock.hashPassword).toHaveBeenCalledWith('secret');
    expect(customerRepositoryMock.create).toHaveBeenCalledWith({
      name: 'Alice',
      email: 'alice@example.com',
      password_hash: 'hashed-secret',
      address: '1 Main St',
    });
    expect(result).toBe(created);
  });

  it('throws ConflictError with EMAIL_ALREADY_REGISTERED when the email is already taken', async () => {
    passwordUtilMock.hashPassword.mockResolvedValue('hashed-secret');
    customerRepositoryMock.create.mockRejectedValue({ parent: { code: '23505' } });

    await expect(
      service.register({ name: 'Alice', email: 'alice@example.com', password: 'secret', address: '1 Main St' })
    ).rejects.toMatchObject({
      code: ACCOUNT_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
    });
    await expect(
      service.register({ name: 'Alice', email: 'alice@example.com', password: 'secret', address: '1 Main St' })
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
