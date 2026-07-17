import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';
import fixtures from '#test/fixtures/bookings.fixture.cjs';

const { BookingRepository } = await import('#repositories/booking.repository');

describe('BookingRepository.updateStatusIfUnchanged (integration)', () => {
  let rollback;
  const repository = new BookingRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('writes and returns the updated row when fromStatus matches the current status', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOnePending] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const updated = await repository.updateStatusIfUnchanged(fixtures.workerOnePending.id, 'PENDING', 'CONFIRMED', {
        transaction,
      });

      expect(updated).not.toBeNull();
      expect(updated.id).toBe(fixtures.workerOnePending.id);
      expect(updated.status).toBe('CONFIRMED');
    });
  });

  it('returns null and does not write when fromStatus does not match the current status', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOneConfirmed] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      // Actual status is CONFIRMED, but we claim it was PENDING — simulates having lost a race.
      const result = await repository.updateStatusIfUnchanged(fixtures.workerOneConfirmed.id, 'PENDING', 'CANCELLED', {
        transaction,
      });

      expect(result).toBeNull();

      const unchanged = await repository.getOne({ where: { id: fixtures.workerOneConfirmed.id }, transaction });
      expect(unchanged.status).toBe('CONFIRMED');
    });
  });

  it('re-fetches by id only, so the returned row reflects its new status rather than being lost', async () => {
    // Regression guard for the exact bug this method exists to avoid: BaseRepository.update
    // re-fetches using the same `where` as the write, which would incorrectly find nothing
    // once the status has already changed away from the old value used in that where clause.
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOneLater] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const updated = await repository.updateStatusIfUnchanged(fixtures.workerOneLater.id, 'PENDING', 'CONFIRMED', {
        transaction,
      });

      expect(updated).not.toBeNull();
      expect(updated.status).toBe('CONFIRMED');
    });
  });
});
