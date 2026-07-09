import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';
import fixtures from '#test/fixtures/bookings.fixture.cjs';

const { BookingRepository } = await import('#repositories/booking.repository');

describe('BookingRepository.getOne (integration)', () => {
  let rollback;
  const repository = new BookingRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('returns null when no booking matches', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const booking = await repository.getOne({ where: { id: 999999 }, transaction });
      expect(booking).toBeNull();
    });
  });

  it('returns the booking when it exists', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOnePending] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const booking = await repository.getOne({ where: { id: fixtures.workerOnePending.id }, transaction });
      expect(booking).not.toBeNull();
      expect(booking.worker_id).toBe(fixtures.workerOnePending.worker_id);
    });
  });
});
