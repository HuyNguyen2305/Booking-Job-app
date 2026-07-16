import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ROLES } from '#constants/role.const';

const passwordUtilMock = { verifyPassword: jest.fn() };
const jwtUtilMock = { signToken: jest.fn() };
jest.unstable_mockModule('#src/common/auth/password.util', () => passwordUtilMock);
jest.unstable_mockModule('#src/common/auth/jwt.util', () => jwtUtilMock);

const adminRepositoryMock = { getOne: jest.fn() };

const { AuthService } = await import('#services/auth.service');
const { UnauthorizedError } = await import('#configs/error');

describe('AuthService.loginAdmin', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(AuthService.prototype);
    service.adminRepository = adminRepositoryMock;
  });

  it('returns a token and profile for valid credentials', async () => {
    const admin = { id: 1, name: 'Root', email: 'root@example.com', is_active: true, password_hash: 'hash' };
    adminRepositoryMock.getOne.mockResolvedValue(admin);
    passwordUtilMock.verifyPassword.mockResolvedValue(true);
    jwtUtilMock.signToken.mockReturnValue('signed-token');

    const result = await service.loginAdmin('root@example.com', 'secret');

    expect(adminRepositoryMock.getOne).toHaveBeenCalledWith({ where: { email: 'root@example.com' } });
    expect(passwordUtilMock.verifyPassword).toHaveBeenCalledWith('secret', 'hash');
    expect(jwtUtilMock.signToken).toHaveBeenCalledWith({ id: 1, role: ROLES.ADMIN });
    expect(result).toEqual({ token: 'signed-token', admin: { id: 1, name: 'Root', email: 'root@example.com' } });
  });

  it('throws UnauthorizedError when no admin exists for the email', async () => {
    adminRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.loginAdmin('nope@example.com', 'secret')).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when the admin is inactive', async () => {
    adminRepositoryMock.getOne.mockResolvedValue({ id: 1, is_active: false, password_hash: 'hash' });

    await expect(service.loginAdmin('root@example.com', 'secret')).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when the password does not match', async () => {
    adminRepositoryMock.getOne.mockResolvedValue({ id: 1, is_active: true, password_hash: 'hash' });
    passwordUtilMock.verifyPassword.mockResolvedValue(false);

    await expect(service.loginAdmin('root@example.com', 'wrong')).rejects.toThrow(UnauthorizedError);
  });
});
