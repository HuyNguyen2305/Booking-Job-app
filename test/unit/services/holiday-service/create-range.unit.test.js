import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const holidayRepositoryMock = {
  bulkCreate: jest.fn(),
};

const { HolidayService } = await import('#services/holiday.service');
const { ValidationError } = await import('#configs/error');

describe('HolidayService.createRange', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(HolidayService.prototype);
    service.holidayRepository = holidayRepositoryMock;
  });

  it('creates one row per day in the inclusive range, all sharing name/recurring_annual', async () => {
    const created = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    holidayRepositoryMock.bulkCreate.mockResolvedValue(created);

    const result = await service.createRange({
      name: 'Tet Holiday',
      start_date: '2027-02-06',
      end_date: '2027-02-08',
      recurring_annual: false,
    });

    expect(holidayRepositoryMock.bulkCreate).toHaveBeenCalledWith([
      { holiday_date: '2027-02-06', name: 'Tet Holiday', recurring_annual: false },
      { holiday_date: '2027-02-07', name: 'Tet Holiday', recurring_annual: false },
      { holiday_date: '2027-02-08', name: 'Tet Holiday', recurring_annual: false },
    ]);
    expect(result).toBe(created);
  });

  it('creates exactly one row when start_date equals end_date', async () => {
    holidayRepositoryMock.bulkCreate.mockResolvedValue([{ id: 'a' }]);

    await service.createRange({ name: 'Solo Day', start_date: '2027-02-06', end_date: '2027-02-06' });

    expect(holidayRepositoryMock.bulkCreate).toHaveBeenCalledWith([
      { holiday_date: '2027-02-06', name: 'Solo Day', recurring_annual: undefined },
    ]);
  });

  it('throws ValidationError when end_date is before start_date', async () => {
    await expect(
      service.createRange({ name: 'Bad Range', start_date: '2027-02-08', end_date: '2027-02-06' })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(holidayRepositoryMock.bulkCreate).not.toHaveBeenCalled();
  });

  it('throws ValidationError for an invalid date', async () => {
    await expect(
      service.createRange({ name: 'Bad Date', start_date: 'not-a-date', end_date: '2027-02-06' })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(holidayRepositoryMock.bulkCreate).not.toHaveBeenCalled();
  });

  it('throws ValidationError when the range spans more than 366 days', async () => {
    await expect(
      service.createRange({ name: 'Way Too Long', start_date: '2027-01-01', end_date: '2030-01-01' })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(holidayRepositoryMock.bulkCreate).not.toHaveBeenCalled();
  });
});
