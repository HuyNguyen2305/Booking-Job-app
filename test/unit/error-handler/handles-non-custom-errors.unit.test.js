import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const bookingServiceMock = {
  createBooking: jest.fn(),
};

class MockBookingService {
  constructor() {
    return bookingServiceMock;
  }
}

jest.unstable_mockModule('#services/booking.service', () => ({ BookingService: MockBookingService }));

const { buildApp } = await import('#src/index');

describe('Global error handler: non-CustomError branch', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const validPayload = {
    worker_id: 1,
    customer_id: 1,
    start_time: '2026-07-14T09:00:00+07:00',
    end_time: '2026-07-14T09:30:00+07:00',
  };

  it('collapses an error with no statusCode into a generic 500, hiding the real message', async () => {
    bookingServiceMock.createBooking.mockRejectedValueOnce(new Error('some unexpected internal failure'));

    const response = await app.inject({ method: 'POST', url: '/api/bookings', payload: validPayload });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ success: false, message: 'Internal server error' });
  });

  it('collapses an error with a 5xx statusCode into a generic 500, hiding the real message', async () => {
    bookingServiceMock.createBooking.mockRejectedValueOnce(
      Object.assign(new Error('upstream failed'), { statusCode: 502 })
    );

    const response = await app.inject({ method: 'POST', url: '/api/bookings', payload: validPayload });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ success: false, message: 'Internal server error' });
  });

  it('preserves the real statusCode and message for a framework-level 4xx error (e.g. malformed JSON body)', async () => {
    // Reproduces the exact reported bug: a malformed JSON body throws a SyntaxError with
    // statusCode 400 from Fastify's own body parser before the route handler ever runs;
    // this must surface as 400, not be collapsed into a generic 500.
    const malformed = '{\n  "start_time": "2026-07-10T02:00:00.000Z,\n  "end_time": "2026-07-10T07:00:00.000Z"\n}';

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/1',
      headers: { 'content-type': 'application/json' },
      payload: malformed,
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.message).not.toBe('Internal server error');
  });
});
