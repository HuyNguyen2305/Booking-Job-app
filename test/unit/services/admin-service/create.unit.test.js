import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const adminRepositoryMock = {
  create: jest.fn(),
};

const passwordUtilMock = { hashPassword: jest.fn() };
jest.unstable_mockModule('#src/common/auth/password.util', () => passwordUtilMock);

const { AdminService } = await import('#services/admin.service');

describe('AdminService.create', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(AdminService.prototype);
    service.adminRepository = adminRepositoryMock;
  });

  it('hashes the password and creates an admin with the given name/email', async () => {
    const created = { id: 1, name: 'Root', email: 'root@example.com' };
    passwordUtilMock.hashPassword.mockResolvedValue('hashed-secret');
    adminRepositoryMock.create.mockResolvedValue(created);

    const result = await service.create({ name: 'Root', email: 'root@example.com', password: 'secret' });

    expect(passwordUtilMock.hashPassword).toHaveBeenCalledWith('secret');
    expect(adminRepositoryMock.create).toHaveBeenCalledWith({
      name: 'Root',
      email: 'root@example.com',
      password_hash: 'hashed-secret',
    });
    expect(result).toBe(created);
  });
});
