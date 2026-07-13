import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const bookingServiceMock = {
  createBooking: jest.fn(),
  updateStatus: jest.fn(),
  rescheduleBooking: jest.fn(),
  reassignBooking: jest.fn(),
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

describe('PATCH /api/bookings/:id/reassign (router + controller + error handler)', () => {
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

  it('returns 200 with the reassigned booking on success', async () => {
    const reassigned = {
      id: 1,
      worker_id: 7,
      start_time: '2026-07-14T09:00:00.000Z',
      end_time: '2026-07-14T09:30:00.000Z',
      status: 'PENDING',
      reassigned: true,
      requested_worker_id: 5,
    };
    bookingServiceMock.reassignBooking.mockResolvedValue(reassigned);

    const response = await app.inject({ method: 'PATCH', url: '/api/bookings/1/reassign' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Booking reassigned', data: reassigned });
    expect(bookingServiceMock.reassignBooking).toHaveBeenCalledWith(1);
  });

  it('returns 404 in the custom error shape when the booking does not exist', async () => {
    bookingServiceMock.reassignBooking.mockRejectedValue(new NotFoundError('Booking not found'));

    const response = await app.inject({ method: 'PATCH', url: '/api/bookings/999/reassign' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ success: false, message: 'Booking not found' });
  });

  it('returns 409 with code WORKER_UNAVAILABLE when no other worker is free', async () => {
    bookingServiceMock.reassignBooking.mockRejectedValue(
      new ConflictError('No worker is available to take over this booking', {
        code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
      })
    );

    const response = await app.inject({ method: 'PATCH', url: '/api/bookings/1/reassign' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ success: false, code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE });
  });

  it('returns 409 when the booking is COMPLETED/CANCELLED', async () => {
    bookingServiceMock.reassignBooking.mockRejectedValue(new ConflictError('Cannot reassign a booking with status COMPLETED'));

    const response = await app.inject({ method: 'PATCH', url: '/api/bookings/1/reassign' });

    expect(response.statusCode).toBe(409);
  });

  it('returns 400 schema validation error for a non-integer id param, without calling the service', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/api/bookings/not-a-number/reassign' });

    expect(response.statusCode).toBe(400);
    expect(bookingServiceMock.reassignBooking).not.toHaveBeenCalled();
  });
});
