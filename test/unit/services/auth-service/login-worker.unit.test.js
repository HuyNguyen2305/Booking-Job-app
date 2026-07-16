import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ROLES } from '#constants/role.const';

const passwordUtilMock = { verifyPassword: jest.fn() };
const jwtUtilMock = { signToken: jest.fn() };
jest.unstable_mockModule('#src/common/auth/password.util', () => passwordUtilMock);
jest.unstable_mockModule('#src/common/auth/jwt.util', () => jwtUtilMock);

const workerRepositoryMock = { getOne: jest.fn() };

const { AuthService } = await import('#services/auth.service');
const { UnauthorizedError } = await import('#configs/error');

describe('AuthService.loginWorker', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(AuthService.prototype);
    service.workerRepository = workerRepositoryMock;
  });

  it('returns a token and profile for valid credentials', async () => {
    const worker = { id: 2, name: 'Alice', email: 'alice@example.com', is_active: true, password_hash: 'hash' };
    workerRepositoryMock.getOne.mockResolvedValue(worker);
    passwordUtilMock.verifyPassword.mockResolvedValue(true);
    jwtUtilMock.signToken.mockReturnValue('signed-token');

    const result = await service.loginWorker('alice@example.com', 'secret');

    expect(workerRepositoryMock.getOne).toHaveBeenCalledWith({ where: { email: 'alice@example.com' } });
    expect(jwtUtilMock.signToken).toHaveBeenCalledWith({ id: 2, role: ROLES.WORKER });
    expect(result).toEqual({ token: 'signed-token', worker: { id: 2, name: 'Alice', email: 'alice@example.com' } });
  });

  it('throws UnauthorizedError when no worker exists for the email', async () => {
    workerRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.loginWorker('nope@example.com', 'secret')).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when the worker is inactive', async () => {
    workerRepositoryMock.getOne.mockResolvedValue({ id: 2, is_active: false, password_hash: 'hash' });

    await expect(service.loginWorker('alice@example.com', 'secret')).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when the password does not match', async () => {
    workerRepositoryMock.getOne.mockResolvedValue({ id: 2, is_active: true, password_hash: 'hash' });
    passwordUtilMock.verifyPassword.mockResolvedValue(false);

    await expect(service.loginWorker('alice@example.com', 'wrong')).rejects.toThrow(UnauthorizedError);
  });
});
