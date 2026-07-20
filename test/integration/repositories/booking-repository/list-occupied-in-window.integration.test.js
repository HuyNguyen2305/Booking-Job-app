import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';
import fixtures from '#test/fixtures/bookings.fixture.cjs';

const { BookingRepository } = await import('#repositories/booking.repository');

describe('BookingRepository.listOccupiedInWindow (integration)', () => {
  let rollback;
  const repository = new BookingRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('returns occupied bookings for the given workers overlapping the window', async () => {
    const ctx = await seedWithTransaction([
      { table: 'bookings', rows: [fixtures.workerOnePending, fixtures.workerTwoPending] },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const rows = await repository.listOccupiedInWindow(
        [501, 502],
        new Date('2026-08-01T00:00:00.000Z'),
        new Date('2026-08-02T00:00:00.000Z'),
        { transaction }
      );
      expect(rows.map((row) => row.id).sort()).toEqual(
        [fixtures.workerOnePending.id, fixtures.workerTwoPending.id].sort()
      );
    });
  });

  it('excludes a CANCELLED booking (not occupied)', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOneCancelled] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const rows = await repository.listOccupiedInWindow(
        [501],
        new Date('2026-08-01T00:00:00.000Z'),
        new Date('2026-08-02T00:00:00.000Z'),
        { transaction }
      );
      expect(rows).toEqual([]);
    });
  });

  it('includes a COMPLETED booking (that time already happened, still occupied)', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOneCompleted] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const rows = await repository.listOccupiedInWindow(
        [501],
        new Date('2026-08-04T00:00:00.000Z'),
        new Date('2026-08-05T00:00:00.000Z'),
        { transaction }
      );
      expect(rows.map((row) => row.id)).toEqual([fixtures.workerOneCompleted.id]);
    });
  });

  it('excludes bookings outside the requested window', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOneLater] }]); // 2026-08-03
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const rows = await repository.listOccupiedInWindow(
        [501],
        new Date('2026-08-01T00:00:00.000Z'),
        new Date('2026-08-02T00:00:00.000Z'),
        { transaction }
      );
      expect(rows).toEqual([]);
    });
  });

  it('excludes bookings for workers not in workerIds', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerTwoPending] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const rows = await repository.listOccupiedInWindow(
        [501],
        new Date('2026-08-01T00:00:00.000Z'),
        new Date('2026-08-02T00:00:00.000Z'),
        { transaction }
      );
      expect(rows).toEqual([]);
    });
  });

  it('returns [] immediately for an empty workerIds array without querying', async () => {
    const rows = await repository.listOccupiedInWindow([], new Date(), new Date());
    expect(rows).toEqual([]);
  });
});
