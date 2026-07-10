import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const holidayRepositoryMock = {
  create: jest.fn(),
};

const { HolidayService } = await import('#services/holiday.service');

describe('HolidayService.create', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(HolidayService.prototype);
    service.holidayRepository = holidayRepositoryMock;
  });

  it('creates a holiday with the given fields', async () => {
    const payload = { holiday_date: '2026-12-25', name: 'Christmas', recurring_annual: false };
    const created = { id: 'uuid-1', ...payload };
    holidayRepositoryMock.create.mockResolvedValue(created);

    const result = await service.create(payload);

    expect(holidayRepositoryMock.create).toHaveBeenCalledWith(payload);
    expect(result).toBe(created);
  });
});
