import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const holidayRepositoryMock = {
  get: jest.fn(),
};

const { HolidayService } = await import('#services/holiday.service');

describe('HolidayService.list', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(HolidayService.prototype);
    service.holidayRepository = holidayRepositoryMock;
  });

  it('returns all holidays ordered by holiday_date ascending', async () => {
    const holidays = [{ id: 'uuid-1' }, { id: 'uuid-2' }];
    holidayRepositoryMock.get.mockResolvedValue(holidays);

    const result = await service.list();

    expect(holidayRepositoryMock.get).toHaveBeenCalledWith({ order: [['holiday_date', 'ASC']] });
    expect(result).toBe(holidays);
  });
});
