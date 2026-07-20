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

  it('returns only bookings for the given worker, sorted by start_time ascending, with pagination metadata', async () => {
    const ctx = await seedWithTransaction([
      {
        table: 'bookings',
        rows: [
          fixtures.workerOneLater,
          fixtures.workerOnePending,
          fixtures.workerOneConfirmed,
          fixtures.workerTwoPending,
        ],
      },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const { rows, count, page, limit, totalPages } = await repository.listByWorker(
        fixtures.workerOnePending.worker_id,
        { transaction }
      );

      expect(rows.map((b) => b.id)).toEqual([
        fixtures.workerOnePending.id,
        fixtures.workerOneConfirmed.id,
        fixtures.workerOneLater.id,
      ]);
      expect(count).toBe(3);
      expect(page).toBe(1);
      expect(limit).toBe(20);
      expect(totalPages).toBe(1);
    });
  });

  it('includes a booking that only partially overlaps the from/to window', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOnePending] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      // window starts mid-way through the booking
      const { rows } = await repository.listByWorker(fixtures.workerOnePending.worker_id, {
        from: '2026-08-01T09:30:00.000Z',
        to: '2026-08-01T12:00:00.000Z',
        transaction,
      });

      expect(rows.map((b) => b.id)).toEqual([fixtures.workerOnePending.id]);
    });
  });

  it('excludes a booking fully outside the from/to window', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOnePending] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const { rows } = await repository.listByWorker(fixtures.workerOnePending.worker_id, {
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-02T00:00:00.000Z',
        transaction,
      });

      expect(rows).toEqual([]);
    });
  });

  it('returns all of the worker bookings when no from/to is supplied', async () => {
    const ctx = await seedWithTransaction([
      { table: 'bookings', rows: [fixtures.workerOnePending, fixtures.workerOneConfirmed] },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const { rows } = await repository.listByWorker(fixtures.workerOnePending.worker_id, { transaction });
      expect(rows).toHaveLength(2);
    });
  });

  it('honors an explicit page/limit', async () => {
    const ctx = await seedWithTransaction([
      { table: 'bookings', rows: [fixtures.workerOnePending, fixtures.workerOneConfirmed, fixtures.workerOneLater] },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const { rows, page, limit, totalPages } = await repository.listByWorker(fixtures.workerOnePending.worker_id, {
        page: 2,
        limit: 1,
        transaction,
      });

      // Sorted by start_time ascending: [workerOnePending, workerOneConfirmed, workerOneLater].
      // Page 2 with limit 1 is the second row.
      expect(rows.map((b) => b.id)).toEqual([fixtures.workerOneConfirmed.id]);
      expect(page).toBe(2);
      expect(limit).toBe(1);
      expect(totalPages).toBe(3);
    });
  });
});
