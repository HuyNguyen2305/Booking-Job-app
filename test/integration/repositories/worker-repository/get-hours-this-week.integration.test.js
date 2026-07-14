import { describe, it, expect, afterEach } from '@jest/globals';
import { DateTime } from 'luxon';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';
import { toBusinessLocalWeekBoundsUtc } from '#utils/date.util';
import { BUSINESS_TZ } from '#constants/business-hours.const';

const { WorkerRepository } = await import('#repositories/worker.repository');

describe('WorkerRepository.getHoursThisWeek (integration)', () => {
  let rollback;
  const repository = new WorkerRepository();
  const workerId = 7001;

  const { weekStart, weekEnd } = toBusinessLocalWeekBoundsUtc(DateTime.now().setZone(BUSINESS_TZ).toISO(), BUSINESS_TZ);
  const weekStartLocal = DateTime.fromJSDate(weekStart).setZone(BUSINESS_TZ);

  // 2 hours COMPLETED, inside the current week.
  const thisWeekBooking = {
    start_time: weekStartLocal.plus({ days: 1, hours: 9 }).toISO(),
    end_time: weekStartLocal.plus({ days: 1, hours: 11 }).toISO(),
  };
  // 3 hours COMPLETED, a full week before weekStart — must not count toward hours_this_week.
  const lastWeekBooking = {
    start_time: weekStartLocal.minus({ days: 6 }).set({ hour: 9 }).toISO(),
    end_time: weekStartLocal.minus({ days: 6 }).set({ hour: 12 }).toISO(),
  };
  // Different slot from thisWeekBooking (same worker can't have two overlapping
  // non-CANCELLED bookings — the DB's EXCLUDE constraint would reject that), but
  // still inside the current week, to prove a non-COMPLETED status doesn't count.
  const thisWeekPendingBooking = {
    start_time: weekStartLocal.plus({ days: 2, hours: 9 }).toISO(),
    end_time: weekStartLocal.plus({ days: 2, hours: 11 }).toISO(),
  };

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('sums COMPLETED hours within the current week only, ignoring other weeks and other statuses', async () => {
    const ctx = await seedWithTransaction([
      {
        table: 'bookings',
        rows: [
          { id: 9001, worker_id: workerId, customer_id: 1, ...thisWeekBooking, status: 'COMPLETED' },
          { id: 9002, worker_id: workerId, customer_id: 1, ...lastWeekBooking, status: 'COMPLETED' },
          { id: 9003, worker_id: workerId, customer_id: 1, ...thisWeekPendingBooking, status: 'PENDING' },
        ],
      },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const hoursThisWeek = await repository.getHoursThisWeek(workerId, { weekStart, weekEnd }, { transaction });
      expect(hoursThisWeek).toBe(2);
    });
  });

  it('returns 0 for a worker with no COMPLETED bookings this week', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const hoursThisWeek = await repository.getHoursThisWeek(999999, { weekStart, weekEnd }, { transaction });
      expect(hoursThisWeek).toBe(0);
    });
  });
});
