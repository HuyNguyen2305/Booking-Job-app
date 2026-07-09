import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const bookingServiceMock = {
  createBooking: jest.fn(),
  updateStatus: jest.fn(),
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

describe('PATCH /api/bookings/:id/status (router + controller + error handler)', () => {
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

  it('returns 200 with the updated booking on success', async () => {
    const updatedBooking = { id: 1, status: 'CONFIRMED' };
    bookingServiceMock.updateStatus.mockResolvedValue(updatedBooking);

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/1/status',
      payload: { status: 'CONFIRMED' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Booking status updated', data: updatedBooking });
    expect(bookingServiceMock.updateStatus).toHaveBeenCalledWith(1, 'CONFIRMED');
  });

  it('returns 404 in the custom error shape when the booking does not exist', async () => {
    bookingServiceMock.updateStatus.mockRejectedValue(new NotFoundError('Booking not found'));

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/999/status',
      payload: { status: 'CONFIRMED' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ success: false, message: 'Booking not found' });
  });

  it('returns 409 in the custom error shape for an illegal transition', async () => {
    bookingServiceMock.updateStatus.mockRejectedValue(
      new ConflictError('Cannot transition booking from COMPLETED to CONFIRMED')
    );

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/1/status',
      payload: { status: 'CONFIRMED' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      success: false,
      message: 'Cannot transition booking from COMPLETED to CONFIRMED',
    });
  });

  it('returns 400 schema validation error for an invalid status enum value, without calling the service', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/1/status',
      payload: { status: 'NOT_A_REAL_STATUS' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe('Validation error');
    expect(bookingServiceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('returns 400 schema validation error for a non-integer id param, without calling the service', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/not-a-number/status',
      payload: { status: 'CONFIRMED' },
    });

    expect(response.statusCode).toBe(400);
    expect(bookingServiceMock.updateStatus).not.toHaveBeenCalled();
  });
});
