import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ROLES } from '#constants/role.const';

const passwordUtilMock = { verifyPassword: jest.fn() };
const jwtUtilMock = { signToken: jest.fn() };
jest.unstable_mockModule('#src/common/auth/password.util', () => passwordUtilMock);
jest.unstable_mockModule('#src/common/auth/jwt.util', () => jwtUtilMock);

const customerRepositoryMock = { getOne: jest.fn() };

const { AuthService } = await import('#services/auth.service');
const { UnauthorizedError } = await import('#configs/error');

describe('AuthService.loginCustomer', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(AuthService.prototype);
    service.customerRepository = customerRepositoryMock;
  });

  it('returns a token and profile for valid credentials', async () => {
    const customer = { id: 3, name: 'Bob', email: 'bob@example.com', is_active: true, password_hash: 'hash' };
    customerRepositoryMock.getOne.mockResolvedValue(customer);
    passwordUtilMock.verifyPassword.mockResolvedValue(true);
    jwtUtilMock.signToken.mockReturnValue('signed-token');

    const result = await service.loginCustomer('bob@example.com', 'secret');

    expect(customerRepositoryMock.getOne).toHaveBeenCalledWith({ where: { email: 'bob@example.com' } });
    expect(jwtUtilMock.signToken).toHaveBeenCalledWith({ id: 3, role: ROLES.CUSTOMER });
    expect(result).toEqual({ token: 'signed-token', customer: { id: 3, name: 'Bob', email: 'bob@example.com' } });
  });

  it('throws UnauthorizedError when no customer exists for the email', async () => {
    customerRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.loginCustomer('nope@example.com', 'secret')).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when the customer is inactive (soft-deleted)', async () => {
    customerRepositoryMock.getOne.mockResolvedValue({ id: 3, is_active: false, password_hash: 'hash' });

    await expect(service.loginCustomer('bob@example.com', 'secret')).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when the password does not match', async () => {
    customerRepositoryMock.getOne.mockResolvedValue({ id: 3, is_active: true, password_hash: 'hash' });
    passwordUtilMock.verifyPassword.mockResolvedValue(false);

    await expect(service.loginCustomer('bob@example.com', 'wrong')).rejects.toThrow(UnauthorizedError);
  });
});
