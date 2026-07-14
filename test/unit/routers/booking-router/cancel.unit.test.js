import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const bookingServiceMock = {
  cancelBooking: jest.fn(),
};

class MockBookingService {
  constructor() {
    return bookingServiceMock;
  }
}

jest.unstable_mockModule('#services/booking.service', () => ({ BookingService: MockBookingService }));

const { buildApp } = await import('#src/index');
const { NotFoundError, ConflictError } = await import('#configs/error');

describe('DELETE /api/bookings/:id (router + controller + error handler)', () => {
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

  it('returns 200 with the cancelled booking on success', async () => {
    const cancelled = { id: 1, status: 'CANCELLED' };
    bookingServiceMock.cancelBooking.mockResolvedValue(cancelled);

    const response = await app.inject({ method: 'DELETE', url: '/api/bookings/1' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Booking cancelled', data: cancelled });
    expect(bookingServiceMock.cancelBooking).toHaveBeenCalledWith(1);
  });

  it('returns 404 in the custom error shape when the booking does not exist', async () => {
    bookingServiceMock.cancelBooking.mockRejectedValue(new NotFoundError('Booking not found'));

    const response = await app.inject({ method: 'DELETE', url: '/api/bookings/999' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ success: false, message: 'Booking not found' });
  });

  it('returns 409 when the booking is already COMPLETED/CANCELLED', async () => {
    bookingServiceMock.cancelBooking.mockRejectedValue(
      new ConflictError('Cannot transition booking from COMPLETED to CANCELLED')
    );

    const response = await app.inject({ method: 'DELETE', url: '/api/bookings/1' });

    expect(response.statusCode).toBe(409);
  });

  it('returns 400 schema validation error for a non-integer id param, without calling the service', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/api/bookings/not-a-number' });

    expect(response.statusCode).toBe(400);
    expect(bookingServiceMock.cancelBooking).not.toHaveBeenCalled();
  });
});
