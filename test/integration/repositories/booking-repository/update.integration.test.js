import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';
import fixtures from '#test/fixtures/bookings.fixture.cjs';

const { BookingRepository } = await import('#repositories/booking.repository');

describe('BookingRepository.update (integration)', () => {
  let rollback;
  const repository = new BookingRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('updates the status of an existing booking and returns the updated record', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOnePending] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const updated = await repository.update(
        { id: fixtures.workerOnePending.id },
        { status: 'CONFIRMED' },
        { transaction }
      );

      expect(updated).not.toBeNull();
      expect(updated.status).toBe('CONFIRMED');
    });
  });

  it('returns null when the where clause matches no rows', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const updated = await repository.update({ id: 999999 }, { status: 'CONFIRMED' }, { transaction });
      expect(updated).toBeNull();
    });
  });
});
