import { describe, it, expect, afterEach } from '@jest/globals';

const { BookingRepository } = await import('#repositories/booking.repository');
const { Worker } = await import('#models/worker.model');
const { Booking } = await import('#models/booking.model');
const { isExclusionConstraintError } = await import('#utils/sequelize-error.util');

/**
 * A genuine Postgres-level race: two independent, actually-committing transactions
 * (not the shared seedWithTransaction rollback pattern used elsewhere, which would
 * defeat the point — two operations inside one open transaction never contend on
 * Postgres's exclusion-constraint locking the way two independent transactions do).
 *
 * Deliberately tested at the BookingRepository level, not through
 * BookingService.createBooking — the service's auto-reassignment fallback loops over
 * every OTHER currently-active worker in the `workers` table, which on a shared dev DB
 * (also used for manual/Swagger testing) can be nonzero and nondeterministic. Testing
 * the raw insert race isolates the actual invariant under test — the DB EXCLUDE
 * constraint serializing two overlapping writes for the SAME worker — from that
 * unrelated, environment-dependent roster state.
 */
describe('BookingRepository.create concurrency (integration)', () => {
  let workerId;
  let bookingIdsToClean = [];

  afterEach(async () => {
    if (bookingIdsToClean.length) {
      await Booking.destroy({ where: { id: bookingIdsToClean } });
      bookingIdsToClean = [];
    }
    if (workerId) {
      await Worker.destroy({ where: { id: workerId } });
      workerId = undefined;
    }
  });

  it('lets exactly one of two overlapping concurrent inserts for the same worker succeed', async () => {
    const worker = await Worker.create({ name: 'Concurrency Test Worker', is_active: true });
    workerId = worker.id;

    const bookingRepository = new BookingRepository();

    // Tuesday 2026-07-14, 09:00-09:30 Asia/Ho_Chi_Minh — valid business-hours weekday slot.
    const payload = {
      worker_id: workerId,
      start_time: '2026-07-14T09:00:00+07:00',
      end_time: '2026-07-14T09:30:00+07:00',
      status: 'PENDING',
    };

    const results = await Promise.allSettled([
      bookingRepository.create({ ...payload, customer_id: 1 }),
      bookingRepository.create({ ...payload, customer_id: 2 }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(isExclusionConstraintError(rejected[0].reason)).toBe(true);

    bookingIdsToClean.push(fulfilled[0].value.id);
  }, 15000);
});
