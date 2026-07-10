import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';
import fixtures from '#test/fixtures/bookings.fixture.cjs';

const { BookingRepository } = await import('#repositories/booking.repository');

describe('BookingRepository.findOverlappingForWorker (integration)', () => {
  let rollback;
  const repository = new BookingRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('detects overlap with an existing PENDING booking for the same worker', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOnePending] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const overlap = await repository.findOverlappingForWorker(
        fixtures.workerOnePending.worker_id,
        '2026-08-01T09:30:00.000Z',
        '2026-08-01T10:30:00.000Z',
        { transaction }
      );
      expect(overlap).not.toBeNull();
    });
  });

  it('detects overlap with an existing CONFIRMED booking for the same worker', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOneConfirmed] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const overlap = await repository.findOverlappingForWorker(
        fixtures.workerOneConfirmed.worker_id,
        '2026-08-02T09:30:00.000Z',
        '2026-08-02T10:30:00.000Z',
        { transaction }
      );
      expect(overlap).not.toBeNull();
    });
  });

  it('detects overlap with an existing COMPLETED booking for the same worker (that time already happened)', async () => {
    // Regression: COMPLETED must still block overlap detection — the job genuinely
    // occupied that slot. Previously ACTIVE_BOOKING_STATUSES excluded COMPLETED here,
    // letting a new booking be created for a slot that was already worked.
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOneCompleted] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const overlap = await repository.findOverlappingForWorker(
        fixtures.workerOneCompleted.worker_id,
        '2026-08-04T09:30:00.000Z',
        '2026-08-04T10:30:00.000Z',
        { transaction }
      );
      expect(overlap).not.toBeNull();
    });
  });

  it('ignores a CANCELLED booking occupying the same range (no false positive)', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOneCancelled] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const overlap = await repository.findOverlappingForWorker(
        fixtures.workerOneCancelled.worker_id,
        fixtures.workerOneCancelled.start_time,
        fixtures.workerOneCancelled.end_time,
        { transaction }
      );
      expect(overlap).toBeNull();
    });
  });

  it('ignores bookings belonging to a different worker', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerTwoPending] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const overlap = await repository.findOverlappingForWorker(
        fixtures.workerOnePending.worker_id,
        fixtures.workerTwoPending.start_time,
        fixtures.workerTwoPending.end_time,
        { transaction }
      );
      expect(overlap).toBeNull();
    });
  });

  it('does not treat a merely touching range as an overlap (boundary case)', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOnePending] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      // candidate starts exactly when the existing booking ends
      const overlap = await repository.findOverlappingForWorker(
        fixtures.workerOnePending.worker_id,
        fixtures.workerOnePending.end_time,
        '2026-08-01T11:00:00.000Z',
        { transaction }
      );
      expect(overlap).toBeNull();
    });
  });

  it('respects excludeId so a booking does not overlap with itself', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOnePending] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const overlap = await repository.findOverlappingForWorker(
        fixtures.workerOnePending.worker_id,
        fixtures.workerOnePending.start_time,
        fixtures.workerOnePending.end_time,
        { excludeId: fixtures.workerOnePending.id, transaction }
      );
      expect(overlap).toBeNull();
    });
  });
});
