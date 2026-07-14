import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const holidayServiceMock = {
  createRange: jest.fn(),
};

class MockHolidayService {
  constructor() {
    return holidayServiceMock;
  }
}

jest.unstable_mockModule('#services/holiday.service', () => ({ HolidayService: MockHolidayService }));

const { buildApp } = await import('#src/index');
const { ValidationError } = await import('#configs/error');

describe('POST /api/holidays/range (router + controller + error handler)', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const payload = { name: 'Tet Holiday', start_date: '2027-02-06', end_date: '2027-02-08', recurring_annual: false };

  it('returns 201 with the created holidays', async () => {
    const holidays = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    holidayServiceMock.createRange.mockResolvedValue(holidays);

    const response = await app.inject({ method: 'POST', url: '/api/holidays/range', payload });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ success: true, message: 'Holidays created', data: holidays });
    expect(holidayServiceMock.createRange).toHaveBeenCalledWith(payload);
  });

  it('returns 400 schema validation error when end_date is missing, without calling the service', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/holidays/range',
      payload: { name: 'Tet Holiday', start_date: '2027-02-06' },
    });

    expect(response.statusCode).toBe(400);
    expect(holidayServiceMock.createRange).not.toHaveBeenCalled();
  });

  it('returns 400 in the custom error shape when the service rejects an invalid range', async () => {
    holidayServiceMock.createRange.mockRejectedValue(new ValidationError('end_date must not be before start_date'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/holidays/range',
      payload: { name: 'Bad Range', start_date: '2027-02-08', end_date: '2027-02-06' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ success: false, message: 'end_date must not be before start_date' });
  });
});
