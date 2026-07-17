import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const bookingServiceMock = {
  createBooking: jest.fn(),
  updateStatus: jest.fn(),
  rescheduleBooking: jest.fn(),
  reassignBooking: jest.fn(),
  listByWorker: jest.fn(),
  listByCustomer: jest.fn(),
  getById: jest.fn(),
  cancelBooking: jest.fn(),
  autoCompletePastBookings: jest.fn(),
};

class MockBookingService {
  constructor() {
    return bookingServiceMock;
  }
}

jest.unstable_mockModule('#services/booking.service', () => ({ BookingService: MockBookingService }));

const { buildApp } = await import('#src/index');
const { signToken } = await import('#src/common/auth/jwt.util');
const { ROLES } = await import('#constants/role.const');

describe('Booking router auth enforcement (NODE_ENV=production)', () => {
  let app;
  let adminToken;
  let workerToken;
  let customerToken;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret';
    app = await buildApp({ logger: false });
    await app.ready();

    adminToken = signToken({ id: 1, role: ROLES.ADMIN });
    workerToken = signToken({ id: 2, role: ROLES.WORKER });
    customerToken = signToken({ id: 5, role: ROLES.CUSTOMER });
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalSecret;
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/bookings returns 401 without a bearer token', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/bookings', payload: {} });
    expect(response.statusCode).toBe(401);
  });

  it('POST /api/bookings returns 403 for WORKER (not allowed to self-book)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      headers: { authorization: `Bearer ${workerToken}` },
      payload: { worker_id: 2, customer_id: 5, start_time: '2026-08-03T02:00:00.000Z', end_time: '2026-08-03T04:00:00.000Z' },
    });
    expect(response.statusCode).toBe(403);
    expect(bookingServiceMock.createBooking).not.toHaveBeenCalled();
  });

  it('POST /api/bookings forces customer_id to the token id for a CUSTOMER caller', async () => {
    bookingServiceMock.createBooking.mockResolvedValue({ id: 10 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: {
        worker_id: 2,
        customer_id: 999, // attempted spoof — must be overridden to the token's own id (5)
        start_time: '2026-08-03T02:00:00.000Z',
        end_time: '2026-08-03T04:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(bookingServiceMock.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: 5 })
    );
  });

  it('GET /api/bookings/:id returns 200 when the WORKER token matches the booking worker_id', async () => {
    bookingServiceMock.getById.mockResolvedValue({ id: 10, worker_id: 2, customer_id: 5 });

    const response = await app.inject({
      method: 'GET',
      url: '/api/bookings/10',
      headers: { authorization: `Bearer ${workerToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('GET /api/bookings/:id returns 403 when the WORKER token does not match the booking worker_id', async () => {
    bookingServiceMock.getById.mockResolvedValue({ id: 10, worker_id: 999, customer_id: 5 });

    const response = await app.inject({
      method: 'GET',
      url: '/api/bookings/10',
      headers: { authorization: `Bearer ${workerToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('PATCH /api/bookings/:id/status returns 200 when the WORKER token matches the booking worker_id and target is CONFIRMED', async () => {
    bookingServiceMock.getById.mockResolvedValue({ id: 10, worker_id: 2, customer_id: 5 });
    bookingServiceMock.updateStatus.mockResolvedValue({ id: 10, status: 'CONFIRMED' });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/10/status',
      headers: { authorization: `Bearer ${workerToken}` },
      payload: { status: 'CONFIRMED' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('PATCH /api/bookings/:id/status returns 403 when a WORKER (even the assigned one) targets COMPLETED', async () => {
    bookingServiceMock.getById.mockResolvedValue({ id: 10, worker_id: 2, customer_id: 5 });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/10/status',
      headers: { authorization: `Bearer ${workerToken}` },
      payload: { status: 'COMPLETED' },
    });

    expect(response.statusCode).toBe(403);
    expect(bookingServiceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('PATCH /api/bookings/:id/status returns 403 when a WORKER (even the assigned one) targets CANCELLED', async () => {
    bookingServiceMock.getById.mockResolvedValue({ id: 10, worker_id: 2, customer_id: 5 });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/10/status',
      headers: { authorization: `Bearer ${workerToken}` },
      payload: { status: 'CANCELLED' },
    });

    expect(response.statusCode).toBe(403);
    expect(bookingServiceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('PATCH /api/bookings/:id/status returns 200 when the owning CUSTOMER targets COMPLETED', async () => {
    bookingServiceMock.getById.mockResolvedValue({ id: 10, worker_id: 2, customer_id: 5 });
    bookingServiceMock.updateStatus.mockResolvedValue({ id: 10, status: 'COMPLETED' });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/10/status',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { status: 'COMPLETED' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('PATCH /api/bookings/:id/status returns 200 when the owning CUSTOMER targets CANCELLED', async () => {
    bookingServiceMock.getById.mockResolvedValue({ id: 10, worker_id: 2, customer_id: 5 });
    bookingServiceMock.updateStatus.mockResolvedValue({ id: 10, status: 'CANCELLED' });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/10/status',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { status: 'CANCELLED' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('PATCH /api/bookings/:id/status returns 403 when the CUSTOMER targets CONFIRMED (wrong role for that target)', async () => {
    bookingServiceMock.getById.mockResolvedValue({ id: 10, worker_id: 2, customer_id: 5 });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/10/status',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { status: 'CONFIRMED' },
    });

    expect(response.statusCode).toBe(403);
    expect(bookingServiceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('PATCH /api/bookings/:id/status returns 409 (not 403) when the assigned WORKER targets PENDING, an always-invalid transition with no mapped owner role', async () => {
    const { ConflictError } = await import('#configs/error');
    bookingServiceMock.getById.mockResolvedValue({ id: 10, worker_id: 2, customer_id: 5 });
    bookingServiceMock.updateStatus.mockRejectedValue(
      new ConflictError('Cannot transition booking from CONFIRMED to PENDING')
    );

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/10/status',
      headers: { authorization: `Bearer ${workerToken}` },
      payload: { status: 'PENDING' },
    });

    expect(response.statusCode).toBe(409);
    // No mapped owner role for PENDING, but the caller must still be SOME owner of the
    // booking (worker or customer) — proven by getById being called and the request
    // reaching the service's transition-table check only because worker_id matches.
    expect(bookingServiceMock.getById).toHaveBeenCalled();
    expect(bookingServiceMock.updateStatus).toHaveBeenCalledWith(10, 'PENDING');
  });

  it('PATCH /api/bookings/:id/status returns 409 (not 403) when the owning CUSTOMER targets PENDING', async () => {
    const { ConflictError } = await import('#configs/error');
    bookingServiceMock.getById.mockResolvedValue({ id: 10, worker_id: 2, customer_id: 5 });
    bookingServiceMock.updateStatus.mockRejectedValue(
      new ConflictError('Cannot transition booking from CONFIRMED to PENDING')
    );

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/10/status',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { status: 'PENDING' },
    });

    expect(response.statusCode).toBe(409);
  });

  it('PATCH /api/bookings/:id/status returns 403 when a non-owning WORKER targets PENDING (can\'t probe an unrelated booking)', async () => {
    bookingServiceMock.getById.mockResolvedValue({ id: 10, worker_id: 999, customer_id: 5 });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/10/status',
      headers: { authorization: `Bearer ${workerToken}` },
      payload: { status: 'PENDING' },
    });

    expect(response.statusCode).toBe(403);
    expect(bookingServiceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('PATCH /api/bookings/:id/status returns 403 when a non-owning CUSTOMER targets PENDING (can\'t probe an unrelated booking)', async () => {
    bookingServiceMock.getById.mockResolvedValue({ id: 10, worker_id: 2, customer_id: 999 });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/10/status',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { status: 'PENDING' },
    });

    expect(response.statusCode).toBe(403);
    expect(bookingServiceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('PATCH /api/bookings/:id/status returns 403 when a non-owning CUSTOMER targets COMPLETED', async () => {
    bookingServiceMock.getById.mockResolvedValue({ id: 10, worker_id: 2, customer_id: 999 });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/10/status',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { status: 'COMPLETED' },
    });

    expect(response.statusCode).toBe(403);
    expect(bookingServiceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('GET /api/bookings ignores a spoofed worker_id for a CUSTOMER caller and always scopes to their own id (IDOR fix)', async () => {
    bookingServiceMock.listByCustomer.mockResolvedValue({ rows: [], count: 0, page: 1, limit: 20, totalPages: 0 });

    const response = await app.inject({
      method: 'GET',
      url: '/api/bookings?worker_id=999', // no customer_id supplied at all
      headers: { authorization: `Bearer ${customerToken}` },
    });

    // worker_id is irrelevant for a CUSTOMER caller and is never even inspected; a missing
    // customer_id is not itself suspicious (it's optional for this role) so this resolves
    // to the caller's own bookings rather than a rejection — the spoofed worker_id simply
    // never reaches listByWorker, which is the actual IDOR guarantee being tested here.
    expect(response.statusCode).toBe(200);
    expect(bookingServiceMock.listByCustomer).toHaveBeenCalledWith(5, expect.anything());
    expect(bookingServiceMock.listByWorker).not.toHaveBeenCalled();
  });

  it('GET /api/bookings never calls listByWorker for a CUSTOMER caller, even with a valid own customer_id present', async () => {
    bookingServiceMock.listByCustomer.mockResolvedValue({ rows: [{ id: 1 }], count: 1, page: 1, limit: 20, totalPages: 1 });

    const response = await app.inject({
      method: 'GET',
      url: '/api/bookings?customer_id=5',
      headers: { authorization: `Bearer ${customerToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(bookingServiceMock.listByCustomer).toHaveBeenCalledWith(5, expect.anything());
    expect(bookingServiceMock.listByWorker).not.toHaveBeenCalled();
  });

  it('GET /api/bookings returns 403 for a CUSTOMER caller who supplies a mismatched customer_id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/bookings?customer_id=999', // present, but not this caller's own id (5)
      headers: { authorization: `Bearer ${customerToken}` },
    });

    expect(response.statusCode).toBe(403);
    expect(bookingServiceMock.listByCustomer).not.toHaveBeenCalled();
  });

  it('GET /api/bookings with no query params returns the CUSTOMER caller\'s own bookings', async () => {
    bookingServiceMock.listByCustomer.mockResolvedValue({ rows: [{ id: 1 }], count: 1, page: 1, limit: 20, totalPages: 1 });

    const response = await app.inject({
      method: 'GET',
      url: '/api/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(bookingServiceMock.listByCustomer).toHaveBeenCalledWith(5, expect.anything());
  });

  it('GET /api/bookings with no query params returns the WORKER caller\'s own bookings', async () => {
    bookingServiceMock.listByWorker.mockResolvedValue({ rows: [{ id: 1 }], count: 1, page: 1, limit: 20, totalPages: 1 });

    const response = await app.inject({
      method: 'GET',
      url: '/api/bookings',
      headers: { authorization: `Bearer ${workerToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(bookingServiceMock.listByWorker).toHaveBeenCalledWith(2, expect.anything());
  });

  it('GET /api/bookings returns 403 for a WORKER caller who supplies a mismatched worker_id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/bookings?worker_id=999', // present, but not this caller's own id (2)
      headers: { authorization: `Bearer ${workerToken}` },
    });

    expect(response.statusCode).toBe(403);
    expect(bookingServiceMock.listByWorker).not.toHaveBeenCalled();
  });

  it('PATCH /api/bookings/:id/reassign returns 403 for CUSTOMER (admin-only)', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/bookings/10/reassign',
      headers: { authorization: `Bearer ${customerToken}` },
    });

    expect(response.statusCode).toBe(403);
    expect(bookingServiceMock.reassignBooking).not.toHaveBeenCalled();
  });

  it('POST /api/bookings/auto-complete returns 403 for WORKER (admin-only)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/bookings/auto-complete',
      headers: { authorization: `Bearer ${workerToken}` },
    });

    expect(response.statusCode).toBe(403);
    expect(bookingServiceMock.autoCompletePastBookings).not.toHaveBeenCalled();
  });
});
