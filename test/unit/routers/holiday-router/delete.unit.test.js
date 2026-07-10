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
const { NotFoundError } = await import('#configs/error');

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

describe('DELETE /api/holidays/:id (router + controller + error handler)', () => {
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

  it('returns 200 with the deleted holiday on success', async () => {
    const holiday = { id: VALID_UUID, holiday_date: '2026-12-25', name: 'Christmas', recurring_annual: false };
    holidayServiceMock.remove.mockResolvedValue(holiday);

    const response = await app.inject({ method: 'DELETE', url: `/api/holidays/${VALID_UUID}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Holiday deleted', data: holiday });
    expect(holidayServiceMock.remove).toHaveBeenCalledWith(VALID_UUID);
  });

  it('returns 404 in the custom error shape when the holiday does not exist', async () => {
    holidayServiceMock.remove.mockRejectedValue(new NotFoundError('Holiday not found'));

    const response = await app.inject({ method: 'DELETE', url: `/api/holidays/${VALID_UUID}` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ success: false, message: 'Holiday not found' });
  });

  it('returns 400 schema validation error for a non-UUID id param, without calling the service', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/api/holidays/not-a-uuid' });

    expect(response.statusCode).toBe(400);
    expect(holidayServiceMock.remove).not.toHaveBeenCalled();
  });
});
