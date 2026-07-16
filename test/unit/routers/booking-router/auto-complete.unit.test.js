import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const bookingServiceMock = {
  autoCompletePastBookings: jest.fn(),
};

class MockBookingService {
  constructor() {
    return bookingServiceMock;
  }
}

jest.unstable_mockModule('#services/booking.service', () => ({ BookingService: MockBookingService }));

const { buildApp } = await import('#src/index');

describe('POST /api/bookings/auto-complete (router + controller)', () => {
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

  it('returns 200 with the completed/failed summary', async () => {
    const result = { completed: [1, 2], failed: [] };
    bookingServiceMock.autoCompletePastBookings.mockResolvedValue(result);

    const response = await app.inject({ method: 'POST', url: '/api/bookings/auto-complete' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Auto-completed 2 booking(s)', data: result });
  });

  it('reflects zero completions in the message', async () => {
    bookingServiceMock.autoCompletePastBookings.mockResolvedValue({ completed: [], failed: [] });

    const response = await app.inject({ method: 'POST', url: '/api/bookings/auto-complete' });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe('Auto-completed 0 booking(s)');
  });
});
