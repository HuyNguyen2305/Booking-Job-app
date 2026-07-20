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
const { ValidationError, ConflictError } = await import('#configs/error');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');

describe('POST /api/bookings (router + controller + error handler)', () => {
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

  const validPayload = {
    worker_id: 1,
    customer_id: 2,
    start_time: '2026-07-09T09:00:00.000Z',
    end_time: '2026-07-09T09:30:00.000Z',
  };

  it('returns 201 with the created booking on success', async () => {
    const createdBooking = { id: 1, ...validPayload, status: 'PENDING' };
    bookingServiceMock.createBooking.mockResolvedValue(createdBooking);

    const response = await app.inject({ method: 'POST', url: '/api/bookings', payload: validPayload });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ success: true, message: 'Booking created', data: createdBooking });
    expect(bookingServiceMock.createBooking).toHaveBeenCalledWith(validPayload);
  });

  it('returns 201 with reassigned/requested_worker_id when the service auto-assigned a different worker', async () => {
    const createdBooking = {
      id: 1,
      ...validPayload,
      worker_id: 5,
      status: 'PENDING',
      reassigned: true,
      requested_worker_id: 1,
    };
    bookingServiceMock.createBooking.mockResolvedValue(createdBooking);

    const response = await app.inject({ method: 'POST', url: '/api/bookings', payload: validPayload });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toEqual(createdBooking);
  });

  it('returns 400 with code INVALID_TIMESTAMP_FORMAT when the service rejects a missing-offset timestamp', async () => {
    bookingServiceMock.createBooking.mockRejectedValue(
      new ValidationError('start_time must be an ISO 8601 date-time with an explicit UTC offset', {
        code: BOOKING_ERROR_CODES.INVALID_TIMESTAMP_FORMAT,
      })
    );

    const response = await app.inject({ method: 'POST', url: '/api/bookings', payload: validPayload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ success: false, code: BOOKING_ERROR_CODES.INVALID_TIMESTAMP_FORMAT });
  });

  it('returns 400 in the custom error shape when the service throws ValidationError', async () => {
    bookingServiceMock.createBooking.mockRejectedValue(
      new ValidationError('end_time must be at least 30 minutes after start_time')
    );

    const response = await app.inject({ method: 'POST', url: '/api/bookings', payload: validPayload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      success: false,
      message: 'end_time must be at least 30 minutes after start_time',
    });
  });

  it('returns 409 in the custom error shape when the service throws ConflictError', async () => {
    bookingServiceMock.createBooking.mockRejectedValue(
      new ConflictError('Worker already has a booking that overlaps this time range')
    );

    const response = await app.inject({ method: 'POST', url: '/api/bookings', payload: validPayload });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      success: false,
      message: 'Worker already has a booking that overlaps this time range',
    });
  });

  it('returns 400 with schema validation errors when a required field is missing, without calling the service', async () => {
    const { customer_id, ...incompletePayload } = validPayload;

    const response = await app.inject({ method: 'POST', url: '/api/bookings', payload: incompletePayload });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe('Validation error');
    expect(body.errors[0].params.missingProperty).toBe('customer_id');
    expect(bookingServiceMock.createBooking).not.toHaveBeenCalled();
  });

  it('returns 500 with a generic message when the service throws an unexpected error', async () => {
    bookingServiceMock.createBooking.mockRejectedValue(new Error('boom'));

    const response = await app.inject({ method: 'POST', url: '/api/bookings', payload: validPayload });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ success: false, message: 'Internal server error' });
  });
});
