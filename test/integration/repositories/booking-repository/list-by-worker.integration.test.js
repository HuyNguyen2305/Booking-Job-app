import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';
import fixtures from '#test/fixtures/bookings.fixture.cjs';

const { BookingRepository } = await import('#repositories/booking.repository');

describe('BookingRepository.listByWorker (integration)', () => {
  let rollback;
  const repository = new BookingRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('returns only bookings for the given worker, sorted by start_time ascending', async () => {
    const ctx = await seedWithTransaction([
      {
        table: 'bookings',
        rows: [fixtures.workerOneLater, fixtures.workerOnePending, fixtures.workerOneConfirmed, fixtures.workerTwoPending],
      },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const bookings = await repository.listByWorker(fixtures.workerOnePending.worker_id, { transaction });

      expect(bookings.map((b) => b.id)).toEqual([
        fixtures.workerOnePending.id,
        fixtures.workerOneConfirmed.id,
        fixtures.workerOneLater.id,
      ]);
    });
  });

  it('includes a booking that only partially overlaps the from/to window', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOnePending] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      // window starts mid-way through the booking
      const bookings = await repository.listByWorker(fixtures.workerOnePending.worker_id, {
        from: '2026-08-01T09:30:00.000Z',
        to: '2026-08-01T12:00:00.000Z',
        transaction,
      });

      expect(bookings.map((b) => b.id)).toEqual([fixtures.workerOnePending.id]);
    });
  });

  it('excludes a booking fully outside the from/to window', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOnePending] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const bookings = await repository.listByWorker(fixtures.workerOnePending.worker_id, {
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-02T00:00:00.000Z',
        transaction,
      });

      expect(bookings).toEqual([]);
    });
  });

  it('returns all of the worker bookings when no from/to is supplied', async () => {
    const ctx = await seedWithTransaction([
      { table: 'bookings', rows: [fixtures.workerOnePending, fixtures.workerOneConfirmed] },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const bookings = await repository.listByWorker(fixtures.workerOnePending.worker_id, { transaction });
      expect(bookings).toHaveLength(2);
    });
  });
});
