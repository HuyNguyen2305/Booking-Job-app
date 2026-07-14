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

  it('delegates to bookingRepository.listByCustomer with the given customer id and range', async () => {
    const bookings = [{ id: 1 }, { id: 2 }];
    bookingRepositoryMock.listByCustomer.mockResolvedValue(bookings);

    const result = await service.listByCustomer(601, { from: '2026-07-01', to: '2026-07-31' });

    expect(bookingRepositoryMock.listByCustomer).toHaveBeenCalledWith(601, {
      from: '2026-07-01',
      to: '2026-07-31',
    });
    expect(result).toBe(bookings);
  });

  it('passes undefined from/to through when no range is given', async () => {
    bookingRepositoryMock.listByCustomer.mockResolvedValue([]);

    await service.listByCustomer(601);

    expect(bookingRepositoryMock.listByCustomer).toHaveBeenCalledWith(601, { from: undefined, to: undefined });
  });
});
