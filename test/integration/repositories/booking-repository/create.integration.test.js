import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { BookingRepository } = await import('#repositories/booking.repository');

describe('BookingRepository.create (integration)', () => {
  let rollback;
  const repository = new BookingRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('inserts a booking row and returns it with the given fields', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const booking = await repository.create(
        {
          worker_id: 501,
          customer_id: 601,
          start_time: '2026-09-01T09:00:00.000Z',
          end_time: '2026-09-01T10:00:00.000Z',
          status: 'PENDING',
        },
        { transaction }
      );

      expect(booking.worker_id).toBe(501);
      expect(booking.customer_id).toBe(601);
      expect(booking.status).toBe('PENDING');
    });
  });

  it('defaults status to PENDING when not explicitly provided', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const booking = await repository.create(
        {
          worker_id: 501,
          customer_id: 601,
          start_time: '2026-09-01T09:00:00.000Z',
          end_time: '2026-09-01T10:00:00.000Z',
        },
        { transaction }
      );

      expect(booking.status).toBe('PENDING');
    });
  });
});
