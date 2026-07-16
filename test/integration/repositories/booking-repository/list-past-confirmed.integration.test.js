import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';
import { nextTuesdayAt } from '#test/helpers/future-dates.js';

const { BookingRepository } = await import('#repositories/booking.repository');

describe('BookingRepository.listPastConfirmed (integration)', () => {
  let rollback;
  const repository = new BookingRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('includes only CONFIRMED bookings whose end_time has already passed', async () => {
    // Distinct worker_ids per row (bookings.worker_id has no hard FK to workers, so these
    // don't need a seeded worker row) so overlapping same-time rows don't trip the DB's
    // no_overlapping_bookings EXCLUDE constraint against each other.
    // 2020-01-06T02:00:00Z / 04:00:00Z = 09:00-11:00 local (Asia/Ho_Chi_Minh, UTC+7) on a
    // Monday — within business hours, satisfying the bookings_business_hours_check constraint.
    const pastConfirmed = {
      id: 9101,
      worker_id: 9201,
      customer_id: 601,
      start_time: '2020-01-06T02:00:00.000Z',
      end_time: '2020-01-06T04:00:00.000Z',
      status: 'CONFIRMED',
    };
    const futureConfirmed = {
      id: 9102,
      worker_id: 9202,
      customer_id: 601,
      start_time: nextTuesdayAt(9, 0),
      end_time: nextTuesdayAt(10, 0),
      status: 'CONFIRMED',
    };
    const pastPending = {
      id: 9103,
      worker_id: 9203,
      customer_id: 601,
      start_time: '2020-01-06T02:00:00.000Z',
      end_time: '2020-01-06T04:00:00.000Z',
      status: 'PENDING',
    };
    const pastCompleted = {
      id: 9104,
      worker_id: 9204,
      customer_id: 601,
      start_time: '2020-01-06T02:00:00.000Z',
      end_time: '2020-01-06T04:00:00.000Z',
      status: 'COMPLETED',
    };

    const ctx = await seedWithTransaction([
      { table: 'bookings', rows: [pastConfirmed, futureConfirmed, pastPending, pastCompleted] },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const bookings = await repository.listPastConfirmed({ transaction });
      const ids = bookings.map((b) => b.id);

      expect(ids).toContain(pastConfirmed.id);
      expect(ids).not.toContain(futureConfirmed.id);
      expect(ids).not.toContain(pastPending.id);
      expect(ids).not.toContain(pastCompleted.id);
    });
  });
});
