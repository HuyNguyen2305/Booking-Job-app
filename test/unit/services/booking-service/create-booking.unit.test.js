import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const bookingRepositoryMock = {
  create: jest.fn(),
};
const workerRepositoryMock = {
  listActive: jest.fn(),
  getAvailability: jest.fn(),
};
const customerRepositoryMock = {
  getOne: jest.fn(),
};
const bookingAvailabilityServiceMock = {
  checkSlotRules: jest.fn(),
  isWorkerFree: jest.fn(),
};

const sequelizeMock = {
  transaction: jest.fn((callback) => callback('mock-transaction')),
};

jest.unstable_mockModule('#models/index', () => ({ sequelize: sequelizeMock }));

const { BookingService } = await import('#services/booking.service');
const { ValidationError, ConflictError } = await import('#configs/error');
const { BOOKING_STATUS } = await import('#constants/booking-status.const');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');

describe('BookingService.createBooking', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    sequelizeMock.transaction.mockImplementation((callback) => callback('mock-transaction'));
    workerRepositoryMock.listActive.mockResolvedValue([]);
    customerRepositoryMock.getOne.mockResolvedValue({ id: 2, name: 'Alice', is_active: true });
    bookingAvailabilityServiceMock.checkSlotRules.mockResolvedValue({ ok: true });

    service = Object.create(BookingService.prototype);
    service.bookingRepository = bookingRepositoryMock;
    service.workerRepository = workerRepositoryMock;
    service.customerRepository = customerRepositoryMock;
    service.bookingAvailabilityService = bookingAvailabilityServiceMock;
  });

  const payload = {
    worker_id: 1,
    customer_id: 2,
    start_time: '2026-07-14T09:00:00+07:00',
    end_time: '2026-07-14T09:30:00+07:00',
  };

  it('throws ValidationError when end_time is less than 30 minutes after start_time', async () => {
    await expect(
      service.createBooking({ ...payload, end_time: '2026-07-14T09:29:00+07:00' })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(bookingAvailabilityServiceMock.checkSlotRules).not.toHaveBeenCalled();
  });

  it('throws ValidationError with CUSTOMER_NOT_FOUND when customer_id does not reference a real customer', async () => {
    customerRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.createBooking(payload)).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.CUSTOMER_NOT_FOUND,
    });
    expect(customerRepositoryMock.getOne).toHaveBeenCalledWith({ where: { id: payload.customer_id } });
    expect(bookingAvailabilityServiceMock.checkSlotRules).not.toHaveBeenCalled();
    expect(bookingRepositoryMock.create).not.toHaveBeenCalled();
  });

  it('throws ValidationError with CUSTOMER_NOT_FOUND when the customer has been deleted (is_active: false)', async () => {
    customerRepositoryMock.getOne.mockResolvedValue({ id: 2, name: 'Alice', is_active: false });

    await expect(service.createBooking(payload)).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.CUSTOMER_NOT_FOUND,
    });
    expect(bookingAvailabilityServiceMock.checkSlotRules).not.toHaveBeenCalled();
    expect(bookingRepositoryMock.create).not.toHaveBeenCalled();
  });

  it('throws with the slot-rule code when checkSlotRules rejects the window', async () => {
    bookingAvailabilityServiceMock.checkSlotRules.mockResolvedValue({
      ok: false,
      code: BOOKING_ERROR_CODES.OUTSIDE_BUSINESS_HOURS,
    });

    await expect(service.createBooking(payload)).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.OUTSIDE_BUSINESS_HOURS,
    });
    expect(bookingRepositoryMock.create).not.toHaveBeenCalled();
  });

  it('books the requested worker when they are free (no reassignment)', async () => {
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 1 }]);
    bookingAvailabilityServiceMock.isWorkerFree.mockResolvedValue(true);
    const createdBooking = { toJSON: () => ({ id: 1, ...payload, status: BOOKING_STATUS.PENDING }) };
    bookingRepositoryMock.create.mockResolvedValue(createdBooking);

    const result = await service.createBooking(payload);

    expect(bookingRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ worker_id: 1, status: BOOKING_STATUS.PENDING }),
      { transaction: 'mock-transaction' }
    );
    expect(result.reassigned).toBe(false);
    expect(result.requested_worker_id).toBeUndefined();
  });

  it('throws ConflictError with WORKER_UNAVAILABLE when the requested worker_id is not a registered active worker and no other active workers exist', async () => {
    // Regression: the workers table is empty (e.g. right after a fresh migration or a
    // truncate), yet the client requests worker_id: 1. Must NOT silently create a
    // booking for a worker_id that was never registered just because no overlapping
    // booking happens to exist yet for that id.
    workerRepositoryMock.listActive.mockResolvedValue([]);

    await expect(service.createBooking(payload)).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
    });
    expect(bookingAvailabilityServiceMock.isWorkerFree).not.toHaveBeenCalled();
    expect(bookingRepositoryMock.create).not.toHaveBeenCalled();
  });

  it('falls back to another active worker when the requested worker_id is not registered/active, without ever assigning the phantom id', async () => {
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 2 }]);
    workerRepositoryMock.getAvailability.mockResolvedValue([{ worker_id: 2, has_overlap: false, booked_hours: 0 }]);
    bookingAvailabilityServiceMock.isWorkerFree.mockResolvedValue(true);
    const createdBooking = { toJSON: () => ({ id: 3, ...payload, worker_id: 2, status: BOOKING_STATUS.PENDING }) };
    bookingRepositoryMock.create.mockResolvedValue(createdBooking);

    const result = await service.createBooking(payload); // payload requests worker_id: 1, which isn't in the active roster

    expect(bookingAvailabilityServiceMock.isWorkerFree).not.toHaveBeenCalledWith(1, expect.anything(), expect.anything(), expect.anything());
    expect(bookingRepositoryMock.create).toHaveBeenCalledWith(expect.objectContaining({ worker_id: 2 }), expect.anything());
    expect(result.reassigned).toBe(true);
    expect(result.requested_worker_id).toBe(1);
  });

  it('falls back to another active worker when the requested one is busy', async () => {
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    workerRepositoryMock.getAvailability.mockResolvedValue([{ worker_id: 2, has_overlap: false, booked_hours: 3 }]);
    bookingAvailabilityServiceMock.isWorkerFree.mockImplementation(async (candidateId) => candidateId === 2);
    const createdBooking = { toJSON: () => ({ id: 5, ...payload, worker_id: 2, status: BOOKING_STATUS.PENDING }) };
    bookingRepositoryMock.create.mockResolvedValue(createdBooking);

    const result = await service.createBooking(payload);

    expect(bookingRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ worker_id: 2 }),
      expect.anything()
    );
    expect(result.reassigned).toBe(true);
    expect(result.requested_worker_id).toBe(1);
    // Regression guard: candidates must be ranked by that business WEEK's occupied
    // hours, not just that single day — see _buildCandidateOrder's weekStart/weekEnd.
    expect(workerRepositoryMock.getAvailability).toHaveBeenCalledWith(
      [2],
      expect.objectContaining({ windowStart: expect.any(Date), windowEnd: expect.any(Date) }),
      { transaction: undefined }
    );
  });

  it('throws ConflictError with WORKER_UNAVAILABLE when every candidate is busy', async () => {
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    workerRepositoryMock.getAvailability.mockResolvedValue([{ worker_id: 2, has_overlap: false, booked_hours: 0 }]);
    bookingAvailabilityServiceMock.isWorkerFree.mockResolvedValue(false);

    await expect(service.createBooking(payload)).rejects.toBeInstanceOf(ConflictError);
    await expect(service.createBooking(payload)).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
    });
    expect(bookingRepositoryMock.create).not.toHaveBeenCalled();
  });

  it('moves to the next candidate when create() loses a race (exclusion constraint violation)', async () => {
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    workerRepositoryMock.getAvailability.mockResolvedValue([{ worker_id: 2, has_overlap: false, booked_hours: 0 }]);
    bookingAvailabilityServiceMock.isWorkerFree.mockResolvedValue(true);

    const exclusionError = Object.assign(new Error('exclusion violation'), { parent: { code: '23P01' } });
    const createdBooking = { toJSON: () => ({ id: 9, ...payload, worker_id: 2, status: BOOKING_STATUS.PENDING }) };
    bookingRepositoryMock.create.mockRejectedValueOnce(exclusionError).mockResolvedValueOnce(createdBooking);

    const result = await service.createBooking(payload);

    expect(bookingRepositoryMock.create).toHaveBeenCalledTimes(2);
    expect(result.reassigned).toBe(true);
  });
});
