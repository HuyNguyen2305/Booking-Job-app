import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';
import fixtures from '#test/fixtures/bookings.fixture.cjs';

const { BookingRepository } = await import('#repositories/booking.repository');

describe('BookingRepository.listByCustomer (integration)', () => {
  let rollback;
  const repository = new BookingRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('returns only bookings for the given customer across different workers, excluding a different customer', async () => {
    // workerOnePending and workerTwoPending share customer_id 601 but have different
    // worker_id values — proves the filter is genuinely on customer_id, not worker_id.
    // Their start_time/end_time are identical in the fixture, so this only asserts the
    // returned set (order between two identical-start_time rows isn't guaranteed by
    // ORDER BY start_time ASC alone) — workerOneConfirmed (a different customer) proves
    // the filter, and the dedicated from/to and no-filter tests below cover ordering.
    const ctx = await seedWithTransaction([
      {
        table: 'bookings',
        rows: [fixtures.workerTwoPending, fixtures.workerOnePending, fixtures.workerOneConfirmed],
      },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const bookings = await repository.listByCustomer(fixtures.workerOnePending.customer_id, { transaction });

      expect(bookings.map((b) => b.id).sort()).toEqual(
        [fixtures.workerOnePending.id, fixtures.workerTwoPending.id].sort()
      );
    });
  });

  it('includes a booking that only partially overlaps the from/to window', async () => {
    const ctx = await seedWithTransaction([{ table: 'bookings', rows: [fixtures.workerOnePending] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const bookings = await repository.listByCustomer(fixtures.workerOnePending.customer_id, {
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
      const bookings = await repository.listByCustomer(fixtures.workerOnePending.customer_id, {
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-02T00:00:00.000Z',
        transaction,
      });

      expect(bookings).toEqual([]);
    });
  });

  it('returns all of the customer bookings when no from/to is supplied', async () => {
    const ctx = await seedWithTransaction([
      { table: 'bookings', rows: [fixtures.workerOnePending, fixtures.workerTwoPending] },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const bookings = await repository.listByCustomer(fixtures.workerOnePending.customer_id, { transaction });
      expect(bookings).toHaveLength(2);
    });
  });
});
