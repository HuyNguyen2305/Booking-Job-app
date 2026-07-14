import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';
import workerFixtures from '#test/fixtures/workers.fixture.cjs';

const { WorkerRepository } = await import('#repositories/worker.repository');

describe('WorkerRepository.getAvailability (integration)', () => {
  let rollback;
  const repository = new WorkerRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  // Tuesday 2026-07-14, business hours 09:00-17:00 Asia/Ho_Chi_Minh (UTC+7).
  const queryWindow = { start: '2026-07-14T10:00:00+07:00', end: '2026-07-14T11:00:00+07:00' };
  const dayBounds = {
    windowStart: new Date('2026-07-13T17:00:00.000Z'), // 2026-07-14T00:00+07:00
    windowEnd: new Date('2026-07-14T17:00:00.000Z'), // 2026-07-15T00:00+07:00
  };

  const bookingRows = [
    {
      id: 8101,
      worker_id: 7001,
      customer_id: 1,
      start_time: '2026-07-14T10:30:00+07:00',
      end_time: '2026-07-14T11:30:00+07:00',
      status: 'PENDING',
    },
    {
      id: 8102,
      worker_id: 7002,
      customer_id: 1,
      start_time: '2026-07-14T14:00:00+07:00',
      end_time: '2026-07-14T15:00:00+07:00',
      status: 'CONFIRMED',
    },
    {
      id: 8103,
      worker_id: 7004,
      customer_id: 1,
      start_time: '2026-07-14T10:00:00+07:00',
      end_time: '2026-07-14T13:00:00+07:00',
      status: 'COMPLETED',
    },
    {
      id: 8104,
      worker_id: 7005,
      customer_id: 1,
      start_time: '2026-07-14T10:00:00+07:00',
      end_time: '2026-07-14T13:00:00+07:00',
      status: 'CANCELLED',
    },
  ];

  it('flags overlapping workers, sums booked hours for the day, and includes zero-booking workers', async () => {
    const ctx = await seedWithTransaction([
      { table: 'workers', rows: workerFixtures.workers },
      { table: 'bookings', rows: bookingRows },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const rows = await repository.getAvailability(
        [7001, 7002, 7003],
        { ...queryWindow, ...dayBounds },
        { transaction }
      );

      const byWorker = Object.fromEntries(rows.map((r) => [r.worker_id, r]));
      expect(byWorker[7001]).toEqual({ worker_id: 7001, has_overlap: true, booked_hours: 1 });
      expect(byWorker[7002]).toEqual({ worker_id: 7002, has_overlap: false, booked_hours: 1 });
      expect(byWorker[7003]).toEqual({ worker_id: 7003, has_overlap: false, booked_hours: 0 });
    });
  });

  it('counts a COMPLETED booking toward overlap and booked hours (that time already happened), but ignores CANCELLED', async () => {
    // Regression: COMPLETED was previously excluded alongside CANCELLED, so a worker
    // fully booked with now-COMPLETED jobs incorrectly showed 0 booked_hours and no
    // overlap, making them appear available for a slot they'd actually worked.
    const ctx = await seedWithTransaction([
      { table: 'workers', rows: workerFixtures.workers },
      { table: 'bookings', rows: bookingRows },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const rows = await repository.getAvailability(
        [7004, 7005],
        { ...queryWindow, ...dayBounds },
        { transaction }
      );

      const byWorker = Object.fromEntries(rows.map((r) => [r.worker_id, r]));
      expect(byWorker[7004]).toEqual({ worker_id: 7004, has_overlap: true, booked_hours: 3 });
      expect(byWorker[7005]).toEqual({ worker_id: 7005, has_overlap: false, booked_hours: 0 });
    });
  });

  it('sums booked hours across a week-wide window, not just the query day, when given week bounds', async () => {
    // Same worker (7002) as the day-scoped test above, but here the caller passes bounds
    // spanning the whole business week — proving getAvailability is genuinely reusable
    // for weekly-hours ranking (BookingService's candidate ordering), not hardcoded to a
    // single day. 7002's existing 1-hour Tuesday booking plus a 2-hour Monday booking in
    // the same week should sum to 3, where a day-scoped window would have only seen 1.
    const mondayBookingRow = {
      id: 8105,
      worker_id: 7002,
      customer_id: 1,
      start_time: '2026-07-13T09:00:00+07:00',
      end_time: '2026-07-13T11:00:00+07:00',
      status: 'CONFIRMED',
    };
    const weekBounds = {
      windowStart: new Date('2026-07-12T17:00:00.000Z'), // 2026-07-13T00:00+07:00 (Monday)
      windowEnd: new Date('2026-07-19T17:00:00.000Z'), // 2026-07-20T00:00+07:00 (following Monday)
    };

    const ctx = await seedWithTransaction([
      { table: 'workers', rows: workerFixtures.workers },
      { table: 'bookings', rows: [...bookingRows, mondayBookingRow] },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const rows = await repository.getAvailability([7002], { ...queryWindow, ...weekBounds }, { transaction });

      const byWorker = Object.fromEntries(rows.map((r) => [r.worker_id, r]));
      expect(byWorker[7002]).toEqual({ worker_id: 7002, has_overlap: false, booked_hours: 3 });
    });
  });

  it('returns an empty array when given no worker ids', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const rows = await repository.getAvailability([], { ...queryWindow, ...dayBounds }, { transaction });
      expect(rows).toEqual([]);
    });
  });
});
