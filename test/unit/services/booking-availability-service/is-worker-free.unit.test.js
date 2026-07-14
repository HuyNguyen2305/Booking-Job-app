import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const bookingRepositoryMock = { findOverlappingForWorker: jest.fn() };

const { BookingAvailabilityService } = await import('#services/booking-availability.service');

describe('BookingAvailabilityService.isWorkerFree', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(BookingAvailabilityService.prototype);
    service.bookingRepository = bookingRepositoryMock;
  });

  it('returns true when the repository finds no overlapping booking', async () => {
    bookingRepositoryMock.findOverlappingForWorker.mockResolvedValue(null);

    const result = await service.isWorkerFree(5, '2026-07-14T09:00:00+07:00', '2026-07-14T10:00:00+07:00');

    expect(result).toBe(true);
  });

  it('returns false when the repository finds an overlapping booking', async () => {
    bookingRepositoryMock.findOverlappingForWorker.mockResolvedValue({ id: 42 });

    const result = await service.isWorkerFree(5, '2026-07-14T09:00:00+07:00', '2026-07-14T10:00:00+07:00');

    expect(result).toBe(false);
  });

  it('passes workerId, startISO, endISO, and the transaction/excludeId options straight through', async () => {
    bookingRepositoryMock.findOverlappingForWorker.mockResolvedValue(null);

    await service.isWorkerFree(5, '2026-07-14T09:00:00+07:00', '2026-07-14T10:00:00+07:00', {
      transaction: 'mock-transaction',
      excludeId: 7,
    });

    expect(bookingRepositoryMock.findOverlappingForWorker).toHaveBeenCalledWith(
      5,
      '2026-07-14T09:00:00+07:00',
      '2026-07-14T10:00:00+07:00',
      { excludeId: 7, transaction: 'mock-transaction' }
    );
  });

  it('defaults transaction/excludeId to undefined when no options are given', async () => {
    bookingRepositoryMock.findOverlappingForWorker.mockResolvedValue(null);

    await service.isWorkerFree(5, '2026-07-14T09:00:00+07:00', '2026-07-14T10:00:00+07:00');

    expect(bookingRepositoryMock.findOverlappingForWorker).toHaveBeenCalledWith(
      5,
      '2026-07-14T09:00:00+07:00',
      '2026-07-14T10:00:00+07:00',
      { excludeId: undefined, transaction: undefined }
    );
  });
});
