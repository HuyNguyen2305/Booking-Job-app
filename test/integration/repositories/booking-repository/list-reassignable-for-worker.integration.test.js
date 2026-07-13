import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';
import fixtures from '#test/fixtures/bookings.fixture.cjs';

const { BookingRepository } = await import('#repositories/booking.repository');

describe('BookingRepository.listReassignableForWorker (integration)', () => {
  let rollback;
  const repository = new BookingRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('includes future PENDING/CONFIRMED bookings but excludes COMPLETED, CANCELLED, and past bookings', async () => {
    const ctx = await seedWithTransaction([
      {
        table: 'bookings',
        rows: [
          fixtures.workerOnePending,
          fixtures.workerOneConfirmed,
          fixtures.workerOneCancelled,
          fixtures.workerOneCompleted,
          fixtures.workerOnePastPending,
        ],
      },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const bookings = await repository.listReassignableForWorker(501, { transaction });
      const ids = bookings.map((b) => b.id);

      expect(ids).toContain(fixtures.workerOnePending.id);
      expect(ids).toContain(fixtures.workerOneConfirmed.id);
      expect(ids).not.toContain(fixtures.workerOneCancelled.id);
      expect(ids).not.toContain(fixtures.workerOneCompleted.id);
      expect(ids).not.toContain(fixtures.workerOnePastPending.id);
    });
  });

  it('ignores bookings belonging to a different worker', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerTwoPending] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const bookings = await repository.listReassignableForWorker(501, { transaction });
      expect(bookings).toEqual([]);
    });
  });

  it('returns an empty array for a worker with no bookings at all', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const bookings = await repository.listReassignableForWorker(999999, { transaction });
      expect(bookings).toEqual([]);
    });
  });
});
