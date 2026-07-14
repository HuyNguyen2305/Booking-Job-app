import { QueryTypes } from 'sequelize';
import { BaseRepository } from '#src/common/base/base.repository';
import { Worker } from '#models/worker.model';
import { OCCUPIED_BOOKING_STATUSES, BOOKING_STATUS } from '#constants/booking-status.const';

export class WorkerRepository extends BaseRepository {
  constructor() {
    super(Worker);
  }

  async listActive({ transaction } = {}) {
    return this.get({ where: { is_active: true }, order: [['id', 'ASC']], transaction });
  }

  /**
   * For each of `workerIds`: whether they have a PENDING/CONFIRMED/COMPLETED booking
   * overlapping [start, end), and their total occupied hours within [windowStart, windowEnd)
   * — callers pass a business-local day's bounds to rank by that day's load (used by
   * WorkerService.listAvailable) or a business-local week's bounds to rank by that week's
   * load (used by BookingService's candidate ordering for assignment/reassignment).
   * COMPLETED bookings still count — that time genuinely happened. Only CANCELLED is
   * excluded. Workers with zero bookings still appear (has_overlap: false, booked_hours: 0).
   *
   * The WHERE clause bounds rows to those that could overlap EITHER [start,end) or
   * [windowStart,windowEnd) (using the widest combined bound via LEAST/GREATEST, since one
   * window doesn't always contain the other) — any row outside that bound would
   * contribute 0 to both aggregates anyway, so this changes nothing about the result,
   * only how many rows get scanned. Without it, every call summed a worker's entire
   * booking history regardless of how far in the past most of it was.
   */
  async getAvailability(workerIds, { start, end, windowStart, windowEnd }, { transaction } = {}) {
    if (!workerIds.length) return [];

    const rows = await this.model.sequelize.query(
      `
      SELECT
        worker_id,
        BOOL_OR(start_time < :end AND end_time > :start) AS has_overlap,
        COALESCE(SUM(
          CASE WHEN start_time < :windowEnd AND end_time > :windowStart
          THEN EXTRACT(EPOCH FROM (LEAST(end_time, :windowEnd) - GREATEST(start_time, :windowStart))) / 3600.0
          ELSE 0 END
        ), 0) AS booked_hours
      FROM bookings
      WHERE worker_id IN (:workerIds)
        AND status IN (:occupiedStatuses)
        AND start_time < GREATEST(:end::timestamptz, :windowEnd::timestamptz)
        AND end_time > LEAST(:start::timestamptz, :windowStart::timestamptz)
      GROUP BY worker_id
      `,
      {
        replacements: { workerIds, start, end, windowStart, windowEnd, occupiedStatuses: OCCUPIED_BOOKING_STATUSES },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    const byWorker = new Map(rows.map((row) => [Number(row.worker_id), row]));
    return workerIds.map((id) => {
      const row = byWorker.get(id);
      return {
        worker_id: id,
        has_overlap: row ? Boolean(row.has_overlap) : false,
        booked_hours: row ? Number(row.booked_hours) : 0,
      };
    });
  }

  /**
   * Hours actually worked (COMPLETED bookings only — PENDING/CONFIRMED haven't
   * happened yet and don't count toward performance) for `workerId` within the
   * current business-local week (Monday-Sunday, clipped to [weekStart, weekEnd)).
   * The WHERE clause bounds rows to [weekStart, weekEnd) directly, so this stays
   * cheap as booking history grows — unlike the all-time total, which is denormalized
   * onto `workers.total_hours` instead (see `incrementTotalHours`) to avoid re-summing
   * the worker's entire booking history on every read.
   */
  async getHoursThisWeek(workerId, { weekStart, weekEnd }, { transaction } = {}) {
    const [row] = await this.model.sequelize.query(
      `
      SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (LEAST(end_time, :weekEnd) - GREATEST(start_time, :weekStart))) / 3600.0
      ), 0) AS hours_this_week
      FROM bookings
      WHERE worker_id = :workerId
        AND status = :completedStatus
        AND start_time < :weekEnd
        AND end_time > :weekStart
      `,
      {
        replacements: { workerId, weekStart, weekEnd, completedStatus: BOOKING_STATUS.COMPLETED },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    return Number(row.hours_this_week);
  }

  /**
   * Atomically adds `hours` to `workers.total_hours` — a single `UPDATE ... SET
   * total_hours = total_hours + :hours` at the DB level, not a read-then-write in JS,
   * so concurrent completions for the same worker can't lose an update to a race.
   * Safe to call unconditionally on every PENDING/CONFIRMED -> COMPLETED transition
   * since COMPLETED is terminal (never reversed), so nothing ever needs to subtract
   * back out.
   */
  async incrementTotalHours(workerId, hours, { transaction } = {}) {
    await this.model.increment('total_hours', { by: hours, where: { id: workerId }, transaction });
  }
}
