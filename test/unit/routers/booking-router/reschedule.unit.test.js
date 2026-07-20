import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const bookingServiceMock = {
  createBooking: jest.fn(),
  updateStatus: jest.fn(),
  rescheduleBooking: jest.fn(),
  listByWorker: jest.fn(),
};

class MockBookingService {
  constructor() {
    return bookingServiceMock;
  }
}

jest.unstable_mockModule('#services/booking.service', () => ({ BookingService: MockBookingService }));

const { buildApp } = await import('#src/index');
const { NotFoundError, ConflictError } = await import('#configs/error');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');

describe('PATCH /api/bookings/:id (router + controller + error handler)', () => {
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

  const payload = { start_time: '2026-07-14T10:00:00+07:00', end_time: '2026-07-14T10:30:00+07:00' };

  it('returns 200 with the rescheduled booking on success', async () => {
    const updatedBooking = { id: 1, worker_id: 5, ...payload, status: 'PENDING', reassigned: false };
    bookingServiceMock.rescheduleBooking.mockResolvedValue(updatedBooking);

    const response = await app.inject({ method: 'PATCH', url: '/api/bookings/1', payload });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Booking rescheduled', data: updatedBooking });
    expect(bookingServiceMock.rescheduleBooking).toHaveBeenCalledWith(1, payload);
  });

  it('returns 404 in the custom error shape when the booking does not exist', async () => {
    bookingServiceMock.rescheduleBooking.mockRejectedValue(new NotFoundError('Booking not found'));

    const response = await app.inject({ method: 'PATCH', url: '/api/bookings/999', payload });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ success: false, message: 'Booking not found' });
  });

  it('returns 409 with code WORKER_UNAVAILABLE when no worker is free', async () => {
    bookingServiceMock.rescheduleBooking.mockRejectedValue(
      new ConflictError('No worker is available for this time slot', { code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE })
    );

    const response = await app.inject({ method: 'PATCH', url: '/api/bookings/1', payload });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ success: false, code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE });
  });

  it('returns 400 schema validation error when start_time is missing, without calling the service', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/1',
      payload: { end_time: payload.end_time },
    });

    expect(response.statusCode).toBe(400);
    expect(bookingServiceMock.rescheduleBooking).not.toHaveBeenCalled();
  });

  it('returns 400 schema validation error for a non-integer id param, without calling the service', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/api/bookings/not-a-number', payload });

    expect(response.statusCode).toBe(400);
    expect(bookingServiceMock.rescheduleBooking).not.toHaveBeenCalled();
  });
});
