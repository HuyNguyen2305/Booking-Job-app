import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const bookingRepositoryMock = {
  getOne: jest.fn(),
};

jest.unstable_mockModule('#models/index', () => ({ sequelize: { transaction: jest.fn() } }));

const { BookingService } = await import('#services/booking.service');
const { NotFoundError } = await import('#configs/error');

describe('BookingService.getById', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(BookingService.prototype);
    service.bookingRepository = bookingRepositoryMock;
  });

  it('returns the booking when it exists', async () => {
    const booking = { id: 1, worker_id: 5 };
    bookingRepositoryMock.getOne.mockResolvedValue(booking);

    const result = await service.getById(1);

    expect(bookingRepositoryMock.getOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toBe(booking);
  });

  it('throws NotFoundError when the booking does not exist', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.getById(999)).rejects.toBeInstanceOf(NotFoundError);
  });
});
