import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { DateTime } from 'luxon';

const bookingRepositoryMock = {
  getOne: jest.fn(),
  update: jest.fn(),
};
const workerRepositoryMock = {
  listActive: jest.fn(),
  getAvailability: jest.fn(),
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
const { NotFoundError, ConflictError } = await import('#configs/error');
const { BOOKING_STATUS } = await import('#constants/booking-status.const');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');

describe('BookingService.rescheduleBooking', () => {
  let service;

  const newWindow = { start_time: '2026-07-14T10:00:00+07:00', end_time: '2026-07-14T10:30:00+07:00' };

  beforeEach(() => {
    jest.clearAllMocks();
    sequelizeMock.transaction.mockImplementation((callback) => callback('mock-transaction'));
    workerRepositoryMock.listActive.mockResolvedValue([]);
    bookingAvailabilityServiceMock.checkSlotRules.mockResolvedValue({ ok: true });

    service = Object.create(BookingService.prototype);
    service.bookingRepository = bookingRepositoryMock;
    service.workerRepository = workerRepositoryMock;
    service.bookingAvailabilityService = bookingAvailabilityServiceMock;
  });

  it('throws NotFoundError when the booking does not exist', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.rescheduleBooking(1, newWindow)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ConflictError when the booking is COMPLETED or CANCELLED', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue({ id: 1, worker_id: 5, status: BOOKING_STATUS.COMPLETED });

    await expect(service.rescheduleBooking(1, newWindow)).rejects.toBeInstanceOf(ConflictError);
    expect(bookingAvailabilityServiceMock.checkSlotRules).not.toHaveBeenCalled();
  });

  it("throws ConflictError with PAST_BOOKING_TIME when the booking's current start_time has already passed", async () => {
    // The worker is presumably already working the job (or done) once its original
    // start_time has passed — rescheduling it to a new time at that point doesn't
    // make sense, regardless of what new window is requested.
    bookingRepositoryMock.getOne.mockResolvedValue({
      id: 1,
      worker_id: 5,
      status: BOOKING_STATUS.PENDING,
      start_time: new Date('2020-01-06T09:00:00+07:00'),
      end_time: new Date('2020-01-06T09:30:00+07:00'),
    });

    await expect(service.rescheduleBooking(1, newWindow)).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.PAST_BOOKING_TIME,
    });
    expect(bookingAvailabilityServiceMock.checkSlotRules).not.toHaveBeenCalled();
    expect(bookingRepositoryMock.update).not.toHaveBeenCalled();
  });

  it('throws with the slot-rule code when the new window violates a calendar rule', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue({ id: 1, worker_id: 5, status: BOOKING_STATUS.PENDING });
    bookingAvailabilityServiceMock.checkSlotRules.mockResolvedValue({
      ok: false,
      code: BOOKING_ERROR_CODES.NON_WEEKDAY_BOOKING,
    });

    await expect(service.rescheduleBooking(1, newWindow)).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.NON_WEEKDAY_BOOKING,
    });
  });

  it('keeps the current worker when they are free at the new time, excluding its own row from the overlap check', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue({ id: 1, worker_id: 5, status: BOOKING_STATUS.PENDING });
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 5 }]);
    bookingAvailabilityServiceMock.isWorkerFree.mockResolvedValue(true);
    const updatedBooking = { toJSON: () => ({ id: 1, worker_id: 5, ...newWindow, status: BOOKING_STATUS.PENDING }) };
    bookingRepositoryMock.update.mockResolvedValue(updatedBooking);

    const result = await service.rescheduleBooking(1, newWindow);

    expect(bookingAvailabilityServiceMock.isWorkerFree).toHaveBeenCalledWith(
      5,
      newWindow.start_time,
      newWindow.end_time,
      expect.objectContaining({ excludeId: 1 })
    );
    expect(result.reassigned).toBe(false);
  });

  it('falls back to another worker when the current one is no longer free', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue({
      id: 1,
      worker_id: 5,
      status: BOOKING_STATUS.PENDING,
      // Computed relative to the real clock (not a hardcoded date) so this stays a
      // valid "not yet passed" booking indefinitely.
      start_time: DateTime.now().plus({ days: 30 }).toISO(),
      end_time: DateTime.now().plus({ days: 30 }).plus({ minutes: 30 }).toISO(),
    });
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 5 }, { id: 6 }]);
    workerRepositoryMock.getAvailability.mockResolvedValue([{ worker_id: 6, has_overlap: false, booked_hours: 0 }]);
    bookingAvailabilityServiceMock.isWorkerFree.mockImplementation(async (candidateId) => candidateId === 6);
    const updatedBooking = { toJSON: () => ({ id: 1, worker_id: 6, ...newWindow, status: BOOKING_STATUS.PENDING }) };
    bookingRepositoryMock.update.mockResolvedValue(updatedBooking);

    const result = await service.rescheduleBooking(1, newWindow);

    expect(bookingRepositoryMock.update).toHaveBeenCalledWith(
      { id: 1 },
      expect.objectContaining({ worker_id: 6 }),
      expect.anything()
    );
    expect(result.reassigned).toBe(true);
    expect(result.requested_worker_id).toBe(5);
  });

  describe('CONFIRMED status handling', () => {
    // Anchored to the real clock (not a hardcoded date) so these stay valid
    // "not yet passed" bookings indefinitely — only the relative offsets between
    // these timestamps matter for _resolveRescheduleStatus's window-containment logic.
    const FUTURE_BASE = DateTime.now().plus({ days: 30 }).set({ hour: 2, minute: 0, second: 0, millisecond: 0 });

    const confirmedBooking = {
      id: 1,
      worker_id: 5,
      status: BOOKING_STATUS.CONFIRMED,
      start_time: FUTURE_BASE.toISO(),
      end_time: FUTURE_BASE.plus({ hours: 8 }).toISO(),
    };

    beforeEach(() => {
      workerRepositoryMock.listActive.mockResolvedValue([{ id: 5 }]);
      bookingAvailabilityServiceMock.isWorkerFree.mockResolvedValue(true);
      bookingRepositoryMock.update.mockImplementation((where, data) => ({
        toJSON: () => ({ id: 1, worker_id: 5, ...data }),
      }));
    });

    it('keeps CONFIRMED when the new window stays fully within the previously confirmed window', async () => {
      bookingRepositoryMock.getOne.mockResolvedValue(confirmedBooking);
      const shrunkWindow = { start_time: FUTURE_BASE.toISO(), end_time: FUTURE_BASE.plus({ hours: 5 }).toISO() };

      const result = await service.rescheduleBooking(1, shrunkWindow);

      expect(bookingRepositoryMock.update).toHaveBeenCalledWith(
        { id: 1 },
        expect.objectContaining({ status: BOOKING_STATUS.CONFIRMED }),
        expect.anything()
      );
      expect(result.status).toBe(BOOKING_STATUS.CONFIRMED);
    });

    it('demotes to PENDING when the new window extends past the previously confirmed window', async () => {
      // Simulates the second reschedule in sequence: booking is now CONFIRMED for
      // [02:00,07:00] (the shrunk window from the previous reschedule); requesting
      // [07:00,10:00] starts exactly where that confirmed window ends, so none of
      // this new time was ever confirmed.
      bookingRepositoryMock.getOne.mockResolvedValue({
        ...confirmedBooking,
        start_time: FUTURE_BASE.toISO(),
        end_time: FUTURE_BASE.plus({ hours: 5 }).toISO(),
      });
      const shiftedWindow = {
        start_time: FUTURE_BASE.plus({ hours: 5 }).toISO(),
        end_time: FUTURE_BASE.plus({ hours: 8 }).toISO(),
      };

      const result = await service.rescheduleBooking(1, shiftedWindow);

      expect(bookingRepositoryMock.update).toHaveBeenCalledWith(
        { id: 1 },
        expect.objectContaining({ status: BOOKING_STATUS.PENDING }),
        expect.anything()
      );
      expect(result.status).toBe(BOOKING_STATUS.PENDING);
    });

    it('leaves a PENDING booking as PENDING even when the new window is not a subset', async () => {
      bookingRepositoryMock.getOne.mockResolvedValue({
        ...confirmedBooking,
        status: BOOKING_STATUS.PENDING,
      });
      const expandedWindow = {
        start_time: FUTURE_BASE.minus({ hours: 1 }).toISO(),
        end_time: FUTURE_BASE.plus({ hours: 9 }).toISO(),
      };

      const result = await service.rescheduleBooking(1, expandedWindow);

      expect(bookingRepositoryMock.update).toHaveBeenCalledWith(
        { id: 1 },
        expect.objectContaining({ status: BOOKING_STATUS.PENDING }),
        expect.anything()
      );
      expect(result.status).toBe(BOOKING_STATUS.PENDING);
    });
  });

  it('throws ConflictError with WORKER_UNAVAILABLE when no worker is free', async () => {
    bookingRepositoryMock.getOne.mockResolvedValue({ id: 1, worker_id: 5, status: BOOKING_STATUS.PENDING });
    workerRepositoryMock.listActive.mockResolvedValue([{ id: 5 }]);
    bookingAvailabilityServiceMock.isWorkerFree.mockResolvedValue(false);

    await expect(service.rescheduleBooking(1, newWindow)).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
    });
    expect(bookingRepositoryMock.update).not.toHaveBeenCalled();
  });

  it("throws ConflictError with WORKER_UNAVAILABLE when the booking's current worker is no longer an active registered worker and no other active workers exist", async () => {
    // Regression: a worker can be deactivated/removed after a booking was made
    // against them (no hard FK). Rescheduling must not silently keep assigning to
    // a worker_id that is no longer active just because no overlap exists for it.
    bookingRepositoryMock.getOne.mockResolvedValue({ id: 1, worker_id: 5, status: BOOKING_STATUS.PENDING });
    workerRepositoryMock.listActive.mockResolvedValue([]);

    await expect(service.rescheduleBooking(1, newWindow)).rejects.toMatchObject({
      code: BOOKING_ERROR_CODES.WORKER_UNAVAILABLE,
    });
    expect(bookingAvailabilityServiceMock.isWorkerFree).not.toHaveBeenCalled();
    expect(bookingRepositoryMock.update).not.toHaveBeenCalled();
  });
});
