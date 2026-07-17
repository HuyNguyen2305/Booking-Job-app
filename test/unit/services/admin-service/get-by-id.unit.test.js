import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const adminRepositoryMock = {
  getOne: jest.fn(),
};

const { AdminService } = await import('#services/admin.service');
const { NotFoundError } = await import('#configs/error');

describe('AdminService.getById', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(AdminService.prototype);
    service.adminRepository = adminRepositoryMock;
  });

  it('returns the admin when found', async () => {
    const admin = { id: 1, name: 'Root', email: 'root@example.com' };
    adminRepositoryMock.getOne.mockResolvedValue(admin);

    const result = await service.getById(1);

    expect(adminRepositoryMock.getOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toBe(admin);
  });

  it('throws NotFoundError when the admin does not exist', async () => {
    adminRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.getById(999)).rejects.toBeInstanceOf(NotFoundError);
  });
});
