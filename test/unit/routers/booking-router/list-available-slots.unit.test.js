import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const bookingAvailabilityServiceMock = {
  listAvailableSlots: jest.fn(),
  checkSlotRules: jest.fn(),
  isWorkerFree: jest.fn(),
};

class MockBookingAvailabilityService {
  constructor() {
    return bookingAvailabilityServiceMock;
  }
}

jest.unstable_mockModule('#services/booking-availability.service', () => ({
  BookingAvailabilityService: MockBookingAvailabilityService,
}));

const { buildApp } = await import('#src/index');

describe('GET /api/bookings/available-slots (router + controller + error handler)', () => {
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

  it('returns 200 with the slots from the service', async () => {
    const slots = [{ start_time: '2026-07-21T02:00:00.000Z', end_time: '2026-07-21T10:00:00.000Z' }];
    bookingAvailabilityServiceMock.listAvailableSlots.mockResolvedValue(slots);

    const response = await app.inject({ method: 'GET', url: '/api/bookings/available-slots?date=2026-07-21' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Available slots retrieved', data: slots });
    expect(bookingAvailabilityServiceMock.listAvailableSlots).toHaveBeenCalledWith('2026-07-21', {
      days: 1,
      duration_minutes: 30,
    });
  });

  it('passes a custom duration_minutes through to the service', async () => {
    bookingAvailabilityServiceMock.listAvailableSlots.mockResolvedValue([]);

    await app.inject({ method: 'GET', url: '/api/bookings/available-slots?date=2026-07-21&duration_minutes=90' });

    expect(bookingAvailabilityServiceMock.listAvailableSlots).toHaveBeenCalledWith('2026-07-21', {
      days: 1,
      duration_minutes: 90,
    });
  });

  it('passes a custom days through to the service, for a week-view request', async () => {
    bookingAvailabilityServiceMock.listAvailableSlots.mockResolvedValue([]);

    await app.inject({ method: 'GET', url: '/api/bookings/available-slots?date=2026-07-21&days=7' });

    expect(bookingAvailabilityServiceMock.listAvailableSlots).toHaveBeenCalledWith('2026-07-21', {
      days: 7,
      duration_minutes: 30,
    });
  });

  it('returns 400 schema validation error when date is missing, without calling the service', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/bookings/available-slots' });

    expect(response.statusCode).toBe(400);
    expect(bookingAvailabilityServiceMock.listAvailableSlots).not.toHaveBeenCalled();
  });

  it('returns 400 schema validation error when duration_minutes is below the 30-minute minimum', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/bookings/available-slots?date=2026-07-21&duration_minutes=10',
    });

    expect(response.statusCode).toBe(400);
    expect(bookingAvailabilityServiceMock.listAvailableSlots).not.toHaveBeenCalled();
  });

  it('returns 400 schema validation error when days exceeds the maximum', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/bookings/available-slots?date=2026-07-21&days=32',
    });

    expect(response.statusCode).toBe(400);
    expect(bookingAvailabilityServiceMock.listAvailableSlots).not.toHaveBeenCalled();
  });
});
