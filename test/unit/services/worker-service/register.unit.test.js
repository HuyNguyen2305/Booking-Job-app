import { jest, describe, it, expect, beforeEach } from '@jest/globals';

process.env.BUSINESS_TZ = 'Asia/Ho_Chi_Minh';

const workerRepositoryMock = {
  create: jest.fn(),
};

const passwordUtilMock = { hashPassword: jest.fn() };
jest.unstable_mockModule('#src/common/auth/password.util', () => passwordUtilMock);

const { WorkerService } = await import('#services/worker.service');

describe('WorkerService.register', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(WorkerService.prototype);
    service.workerRepository = workerRepositoryMock;
  });

  it('hashes the password and creates a worker with the given name/email', async () => {
    const created = { id: 1, name: 'Alice', email: 'alice@example.com', is_active: true };
    passwordUtilMock.hashPassword.mockResolvedValue('hashed-secret');
    workerRepositoryMock.create.mockResolvedValue(created);

    const result = await service.register({ name: 'Alice', email: 'alice@example.com', password: 'secret' });

    expect(passwordUtilMock.hashPassword).toHaveBeenCalledWith('secret');
    expect(workerRepositoryMock.create).toHaveBeenCalledWith({
      name: 'Alice',
      email: 'alice@example.com',
      password_hash: 'hashed-secret',
    });
    expect(result).toBe(created);
  });
});
