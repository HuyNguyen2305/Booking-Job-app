import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const bookingRepositoryMock = {
  listByCustomer: jest.fn(),
};

jest.unstable_mockModule('#models/index', () => ({ sequelize: { transaction: jest.fn() } }));

const { BookingService } = await import('#services/booking.service');

describe('BookingService.listByCustomer', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(BookingService.prototype);
    service.bookingRepository = bookingRepositoryMock;
  });

  it('delegates to bookingRepository.listByCustomer with the given customer id, range, and page/limit', async () => {
    const paginated = { rows: [{ id: 1 }, { id: 2 }], count: 2, page: 1, limit: 20, totalPages: 1 };
    bookingRepositoryMock.listByCustomer.mockResolvedValue(paginated);

    const result = await service.listByCustomer(601, { from: '2026-07-01', to: '2026-07-31', page: 1, limit: 20 });

    expect(bookingRepositoryMock.listByCustomer).toHaveBeenCalledWith(601, {
      from: '2026-07-01',
      to: '2026-07-31',
      page: 1,
      limit: 20,
    });
    expect(result).toBe(paginated);
  });

  it('passes undefined from/to/page/limit through when none is given', async () => {
    bookingRepositoryMock.listByCustomer.mockResolvedValue({ rows: [], count: 0, page: 1, limit: 20, totalPages: 0 });

    await service.listByCustomer(601);

    expect(bookingRepositoryMock.listByCustomer).toHaveBeenCalledWith(601, {
      from: undefined,
      to: undefined,
      page: undefined,
      limit: undefined,
    });
  });
});
