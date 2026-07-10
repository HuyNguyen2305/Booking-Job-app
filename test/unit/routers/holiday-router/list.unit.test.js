import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const holidayServiceMock = {
  create: jest.fn(),
  list: jest.fn(),
  remove: jest.fn(),
};

class MockHolidayService {
  constructor() {
    return holidayServiceMock;
  }
}

jest.unstable_mockModule('#services/holiday.service', () => ({ HolidayService: MockHolidayService }));

const { buildApp } = await import('#src/index');

describe('GET /api/holidays (router + controller)', () => {
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

  it('returns 200 with the full holiday list', async () => {
    const holidays = [{ id: 'uuid-1', holiday_date: '2026-12-25', name: 'Christmas', recurring_annual: false }];
    holidayServiceMock.list.mockResolvedValue(holidays);

    const response = await app.inject({ method: 'GET', url: '/api/holidays' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: [], data: holidays });
  });
});
