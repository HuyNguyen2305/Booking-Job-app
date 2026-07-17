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

describe('POST /api/holidays (router + controller + error handler)', () => {
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

  const payload = { holiday_date: '2026-12-25', name: 'Christmas', recurring_annual: false };

  it('returns 201 with the created holiday', async () => {
    const holiday = { id: 'uuid-1', ...payload };
    holidayServiceMock.create.mockResolvedValue(holiday);

    const response = await app.inject({ method: 'POST', url: '/api/holidays', payload });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ success: true, message: 'Holiday created', data: holiday });
    expect(holidayServiceMock.create).toHaveBeenCalledWith(payload);
  });

  it('returns 400 schema validation error when name is missing, without calling the service', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/holidays',
      payload: { holiday_date: '2026-12-25' },
    });

    expect(response.statusCode).toBe(400);
    expect(holidayServiceMock.create).not.toHaveBeenCalled();
  });

  it('returns 400 schema validation error when name exceeds 255 chars, without calling the service', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/holidays',
      payload: { holiday_date: '2026-12-25', name: 'a'.repeat(256) },
    });

    expect(response.statusCode).toBe(400);
    expect(holidayServiceMock.create).not.toHaveBeenCalled();
  });
});
