import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';
import { nextTuesdayAt } from '#test/helpers/future-dates.js';

const { BookingRepository } = await import('#repositories/booking.repository');

describe('BookingRepository.listActiveForCustomer (integration)', () => {
  let rollback;
  const repository = new BookingRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('includes PENDING/CONFIRMED bookings at any time but excludes COMPLETED/CANCELLED', async () => {
    // Distinct worker_ids per row (bookings.worker_id has no hard FK) so overlapping
    // same-time rows don't trip the DB's no_overlapping_bookings EXCLUDE constraint.
    const pendingFuture = {
      id: 9301,
      worker_id: 9401,
      customer_id: 9501,
      start_time: nextTuesdayAt(9, 0),
      end_time: nextTuesdayAt(10, 0),
      status: 'PENDING',
    };
    const confirmedFuture = {
      id: 9302,
      worker_id: 9402,
      customer_id: 9501,
      start_time: nextTuesdayAt(11, 0),
      end_time: nextTuesdayAt(12, 0),
      status: 'CONFIRMED',
    };
    // 2020-01-06T02:00:00Z/04:00:00Z = 09:00-11:00 local (Asia/Ho_Chi_Minh, UTC+7) on a
    // Monday, within business hours — a fixed past date so this stays valid indefinitely.
    const confirmedPast = {
      id: 9303,
      worker_id: 9403,
      customer_id: 9501,
      start_time: '2020-01-06T02:00:00.000Z',
      end_time: '2020-01-06T04:00:00.000Z',
      status: 'CONFIRMED',
    };
    const cancelled = {
      id: 9304,
      worker_id: 9404,
      customer_id: 9501,
      start_time: nextTuesdayAt(13, 0),
      end_time: nextTuesdayAt(14, 0),
      status: 'CANCELLED',
    };
    const completed = {
      id: 9305,
      worker_id: 9405,
      customer_id: 9501,
      start_time: '2020-01-06T02:00:00.000Z',
      end_time: '2020-01-06T04:00:00.000Z',
      status: 'COMPLETED',
    };
    const otherCustomer = {
      id: 9306,
      worker_id: 9406,
      customer_id: 9502,
      start_time: nextTuesdayAt(15, 0),
      end_time: nextTuesdayAt(16, 0),
      status: 'PENDING',
    };

    const ctx = await seedWithTransaction([
      { table: 'bookings', rows: [pendingFuture, confirmedFuture, confirmedPast, cancelled, completed, otherCustomer] },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const bookings = await repository.listActiveForCustomer(9501, { transaction });
      const ids = bookings.map((b) => b.id);

      expect(ids).toContain(pendingFuture.id);
      expect(ids).toContain(confirmedFuture.id);
      expect(ids).toContain(confirmedPast.id);
      expect(ids).not.toContain(cancelled.id);
      expect(ids).not.toContain(completed.id);
      expect(ids).not.toContain(otherCustomer.id);
    });
  });
});
