import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const holidayRepositoryMock = {
  getOne: jest.fn(),
  delete: jest.fn(),
};

const { HolidayService } = await import('#services/holiday.service');
const { NotFoundError } = await import('#configs/error');

describe('HolidayService.remove', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(HolidayService.prototype);
    service.holidayRepository = holidayRepositoryMock;
  });

  it('throws NotFoundError when the holiday does not exist', async () => {
    holidayRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.remove('missing-id')).rejects.toBeInstanceOf(NotFoundError);
    expect(holidayRepositoryMock.delete).not.toHaveBeenCalled();
  });

  it('deletes and returns the holiday when it exists', async () => {
    const holiday = { id: 'uuid-1', name: 'Christmas' };
    holidayRepositoryMock.getOne.mockResolvedValue(holiday);
    holidayRepositoryMock.delete.mockResolvedValue(1);

    const result = await service.remove('uuid-1');

    expect(holidayRepositoryMock.delete).toHaveBeenCalledWith({ id: 'uuid-1' });
    expect(result).toBe(holiday);
  });
});
