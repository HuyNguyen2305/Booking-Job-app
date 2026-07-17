import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Op } from 'sequelize';

const customerRepositoryMock = {
  pagination: jest.fn(),
};

const { CustomerService } = await import('#services/customer.service');

describe('CustomerService.list', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(CustomerService.prototype);
    service.customerRepository = customerRepositoryMock;
  });

  it('returns a paginated customer roster ordered by id ascending', async () => {
    const paginated = { rows: [{ id: 1 }, { id: 2 }], count: 2, page: 1, limit: 20, totalPages: 1 };
    customerRepositoryMock.pagination.mockResolvedValue(paginated);

    const result = await service.list();

    expect(customerRepositoryMock.pagination).toHaveBeenCalledWith({
      where: {},
      order: [['id', 'ASC']],
      page: undefined,
      limit: undefined,
    });
    expect(result).toBe(paginated);
  });

  it('passes page/limit through when given', async () => {
    customerRepositoryMock.pagination.mockResolvedValue({ rows: [], count: 0, page: 2, limit: 5, totalPages: 0 });

    await service.list({ page: 2, limit: 5 });

    expect(customerRepositoryMock.pagination).toHaveBeenCalledWith({
      where: {},
      order: [['id', 'ASC']],
      page: 2,
      limit: 5,
    });
  });

  it('builds a case-insensitive substring where for name/email and an exact match for is_active', async () => {
    customerRepositoryMock.pagination.mockResolvedValue({ rows: [], count: 0, page: 1, limit: 20, totalPages: 0 });

    await service.list({ name: 'ali', email: 'example.com', is_active: true });

    expect(customerRepositoryMock.pagination).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { [Op.iLike]: '%ali%' }, email: { [Op.iLike]: '%example.com%' }, is_active: true },
      })
    );
  });

  it('omits a filter entirely when it is not supplied, rather than matching it against undefined', async () => {
    customerRepositoryMock.pagination.mockResolvedValue({ rows: [], count: 0, page: 1, limit: 20, totalPages: 0 });

    await service.list({ name: 'ali' });

    const { where } = customerRepositoryMock.pagination.mock.calls[0][0];
    expect(where).toEqual({ name: { [Op.iLike]: '%ali%' } });
  });
});
