import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const bookingServiceMock = {
  createBooking: jest.fn(),
  updateStatus: jest.fn(),
  listByWorker: jest.fn(),
  listByCustomer: jest.fn(),
};

class MockBookingService {
  constructor() {
    return bookingServiceMock;
  }
}

jest.unstable_mockModule('#services/booking.service', () => ({ BookingService: MockBookingService }));

const { buildApp } = await import('#src/index');

describe('GET /api/bookings (router + controller + error handler)', () => {
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

  it('returns 200 with the worker schedule from the service', async () => {
    const bookings = [{ id: 1 }, { id: 2 }];
    bookingServiceMock.listByWorker.mockResolvedValue(bookings);

    const response = await app.inject({ method: 'GET', url: '/api/bookings?worker_id=5' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Bookings retrieved', data: bookings });
    expect(bookingServiceMock.listByWorker).toHaveBeenCalledWith(5, { from: undefined, to: undefined });
  });

  it('passes from/to querystring filters through to the service', async () => {
    bookingServiceMock.listByWorker.mockResolvedValue([]);

    await app.inject({
      method: 'GET',
      url: '/api/bookings?worker_id=5&from=2026-08-01T00:00:00.000Z&to=2026-08-31T00:00:00.000Z',
    });

    expect(bookingServiceMock.listByWorker).toHaveBeenCalledWith(5, {
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-31T00:00:00.000Z',
    });
  });

  it('returns 200 with the customer schedule from the service when customer_id is given', async () => {
    const bookings = [{ id: 3 }];
    bookingServiceMock.listByCustomer.mockResolvedValue(bookings);

    const response = await app.inject({ method: 'GET', url: '/api/bookings?customer_id=601' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Bookings retrieved', data: bookings });
    expect(bookingServiceMock.listByCustomer).toHaveBeenCalledWith(601, { from: undefined, to: undefined });
    expect(bookingServiceMock.listByWorker).not.toHaveBeenCalled();
  });

  it('returns 400 schema validation error when neither worker_id nor customer_id is given, without calling the service', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/bookings' });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe('Validation error');
    expect(bookingServiceMock.listByWorker).not.toHaveBeenCalled();
    expect(bookingServiceMock.listByCustomer).not.toHaveBeenCalled();
  });
});
