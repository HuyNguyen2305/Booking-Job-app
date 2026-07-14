import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const bookingServiceMock = {
  getById: jest.fn(),
};

class MockBookingService {
  constructor() {
    return bookingServiceMock;
  }
}

jest.unstable_mockModule('#services/booking.service', () => ({ BookingService: MockBookingService }));

const { buildApp } = await import('#src/index');
const { NotFoundError } = await import('#configs/error');

describe('GET /api/bookings/:id (router + controller + error handler)', () => {
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

  it('returns 200 with the booking from the service', async () => {
    const booking = { id: 1, worker_id: 5, customer_id: 601, status: 'PENDING' };
    bookingServiceMock.getById.mockResolvedValue(booking);

    const response = await app.inject({ method: 'GET', url: '/api/bookings/1' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Booking retrieved', data: booking });
    expect(bookingServiceMock.getById).toHaveBeenCalledWith(1);
  });

  it('returns 404 in the custom error shape when the booking does not exist', async () => {
    bookingServiceMock.getById.mockRejectedValue(new NotFoundError('Booking not found'));

    const response = await app.inject({ method: 'GET', url: '/api/bookings/999' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ success: false, message: 'Booking not found' });
  });

  it('returns 400 schema validation error for a non-integer id param, without calling the service', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/bookings/not-a-number' });

    expect(response.statusCode).toBe(400);
    expect(bookingServiceMock.getById).not.toHaveBeenCalled();
  });
});
