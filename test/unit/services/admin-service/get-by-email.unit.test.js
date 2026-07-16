import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const adminRepositoryMock = {
  getOne: jest.fn(),
};

const { AdminService } = await import('#services/admin.service');

describe('AdminService.getByEmail', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(AdminService.prototype);
    service.adminRepository = adminRepositoryMock;
  });

  it('delegates to adminRepository.getOne with the given email', async () => {
    const admin = { id: 1, name: 'Root', email: 'root@example.com' };
    adminRepositoryMock.getOne.mockResolvedValue(admin);

    const result = await service.getByEmail('root@example.com');

    expect(adminRepositoryMock.getOne).toHaveBeenCalledWith({ where: { email: 'root@example.com' } });
    expect(result).toBe(admin);
  });

  it('returns null when no admin matches the email', async () => {
    adminRepositoryMock.getOne.mockResolvedValue(null);

    const result = await service.getByEmail('nope@example.com');

    expect(result).toBeNull();
  });
});
