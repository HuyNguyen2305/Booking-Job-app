import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const bookingRepositoryMock = {
  listByWorker: jest.fn(),
};

jest.unstable_mockModule('#models/index', () => ({ sequelize: { transaction: jest.fn() } }));

const { BookingService } = await import('#services/booking.service');

describe('BookingService.listByWorker', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(BookingService.prototype);
    service.bookingRepository = bookingRepositoryMock;
  });

  it('delegates to bookingRepository.listByWorker with the given worker id, range, and page/limit', async () => {
    const paginated = { rows: [{ id: 1 }, { id: 2 }], count: 2, page: 1, limit: 20, totalPages: 1 };
    bookingRepositoryMock.listByWorker.mockResolvedValue(paginated);

    const result = await service.listByWorker(42, { from: '2026-07-01', to: '2026-07-31', page: 1, limit: 20 });

    expect(bookingRepositoryMock.listByWorker).toHaveBeenCalledWith(42, {
      from: '2026-07-01',
      to: '2026-07-31',
      page: 1,
      limit: 20,
    });
    expect(result).toBe(paginated);
  });

  it('passes undefined from/to/page/limit through when none is given', async () => {
    bookingRepositoryMock.listByWorker.mockResolvedValue({ rows: [], count: 0, page: 1, limit: 20, totalPages: 0 });

    await service.listByWorker(42);

    expect(bookingRepositoryMock.listByWorker).toHaveBeenCalledWith(42, {
      from: undefined,
      to: undefined,
      page: undefined,
      limit: undefined,
    });
  });
});
