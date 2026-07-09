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

  it('delegates to bookingRepository.listByWorker with the given worker id and range', async () => {
    const bookings = [{ id: 1 }, { id: 2 }];
    bookingRepositoryMock.listByWorker.mockResolvedValue(bookings);

    const result = await service.listByWorker(42, { from: '2026-07-01', to: '2026-07-31' });

    expect(bookingRepositoryMock.listByWorker).toHaveBeenCalledWith(42, {
      from: '2026-07-01',
      to: '2026-07-31',
    });
    expect(result).toBe(bookings);
  });

  it('passes undefined from/to through when no range is given', async () => {
    bookingRepositoryMock.listByWorker.mockResolvedValue([]);

    await service.listByWorker(42);

    expect(bookingRepositoryMock.listByWorker).toHaveBeenCalledWith(42, { from: undefined, to: undefined });
  });
});
