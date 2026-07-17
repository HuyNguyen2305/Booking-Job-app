import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Op } from 'sequelize';

const adminRepositoryMock = {
  pagination: jest.fn(),
};

const { AdminService } = await import('#services/admin.service');

describe('AdminService.list', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(AdminService.prototype);
    service.adminRepository = adminRepositoryMock;
  });

  it('paginates admins ordered by id ascending', async () => {
    const paginated = { rows: [{ id: 1, name: 'Root' }], count: 1, page: 1, limit: 20, totalPages: 1 };
    adminRepositoryMock.pagination.mockResolvedValue(paginated);

    const result = await service.list({ page: 1, limit: 20 });

    expect(adminRepositoryMock.pagination).toHaveBeenCalledWith({ where: {}, order: [['id', 'ASC']], page: 1, limit: 20 });
    expect(result).toBe(paginated);
  });

  it('works with no arguments, passing page/limit as undefined through to the repository', async () => {
    adminRepositoryMock.pagination.mockResolvedValue({ rows: [], count: 0, page: 1, limit: 20, totalPages: 0 });

    await service.list();

    expect(adminRepositoryMock.pagination).toHaveBeenCalledWith({
      where: {},
      order: [['id', 'ASC']],
      page: undefined,
      limit: undefined,
    });
  });

  it('builds a case-insensitive substring where for name/email and an exact match for is_active', async () => {
    adminRepositoryMock.pagination.mockResolvedValue({ rows: [], count: 0, page: 1, limit: 20, totalPages: 0 });

    await service.list({ name: 'root', email: 'example.com', is_active: true });

    expect(adminRepositoryMock.pagination).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { [Op.iLike]: '%root%' }, email: { [Op.iLike]: '%example.com%' }, is_active: true },
      })
    );
  });
});
