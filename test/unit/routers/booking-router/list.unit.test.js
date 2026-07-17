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

  it('returns 200 with the paginated worker schedule from the service', async () => {
    const paginated = { rows: [{ id: 1 }, { id: 2 }], count: 2, page: 1, limit: 20, totalPages: 1 };
    bookingServiceMock.listByWorker.mockResolvedValue(paginated);

    const response = await app.inject({ method: 'GET', url: '/api/bookings?worker_id=5' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Bookings retrieved', data: paginated });
    // Schema defaults (page:1, limit:20) apply even when omitted from the querystring.
    expect(bookingServiceMock.listByWorker).toHaveBeenCalledWith(5, {
      from: undefined,
      to: undefined,
      page: 1,
      limit: 20,
    });
  });

  it('passes from/to/page/limit querystring filters through to the service', async () => {
    bookingServiceMock.listByWorker.mockResolvedValue({ rows: [], count: 0, page: 2, limit: 5, totalPages: 0 });

    await app.inject({
      method: 'GET',
      url: '/api/bookings?worker_id=5&from=2026-08-01T00:00:00.000Z&to=2026-08-31T00:00:00.000Z&page=2&limit=5',
    });

    expect(bookingServiceMock.listByWorker).toHaveBeenCalledWith(5, {
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-31T00:00:00.000Z',
      page: 2,
      limit: 5,
    });
  });

  it('returns 200 with the paginated customer schedule from the service when customer_id is given', async () => {
    const paginated = { rows: [{ id: 3 }], count: 1, page: 1, limit: 20, totalPages: 1 };
    bookingServiceMock.listByCustomer.mockResolvedValue(paginated);

    const response = await app.inject({ method: 'GET', url: '/api/bookings?customer_id=601' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Bookings retrieved', data: paginated });
    expect(bookingServiceMock.listByCustomer).toHaveBeenCalledWith(601, {
      from: undefined,
      to: undefined,
      page: 1,
      limit: 20,
    });
    expect(bookingServiceMock.listByWorker).not.toHaveBeenCalled();
  });

  it('returns 400 when neither worker_id nor customer_id is given for an ADMIN caller, without calling the service', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/bookings' });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe('worker_id or customer_id is required');
    expect(bookingServiceMock.listByWorker).not.toHaveBeenCalled();
    expect(bookingServiceMock.listByCustomer).not.toHaveBeenCalled();
  });

  it('returns 400 schema validation error when both worker_id and customer_id are given, without calling the service', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/bookings?worker_id=5&customer_id=601' });

    expect(response.statusCode).toBe(400);
    expect(bookingServiceMock.listByWorker).not.toHaveBeenCalled();
    expect(bookingServiceMock.listByCustomer).not.toHaveBeenCalled();
  });

  it('returns 400 schema validation error when limit exceeds the maximum, without calling the service', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/bookings?worker_id=5&limit=101' });

    expect(response.statusCode).toBe(400);
    expect(bookingServiceMock.listByWorker).not.toHaveBeenCalled();
    expect(bookingServiceMock.listByCustomer).not.toHaveBeenCalled();
  });
});
