import { QueryTypes } from 'sequelize';
import { BaseRepository } from '#src/common/base/base.repository';
import { Worker } from '#models/worker.model';
import { OCCUPIED_BOOKING_STATUSES } from '#constants/booking-status.const';

export class WorkerRepository extends BaseRepository {
  constructor() {
    super(Worker);
  }

  async listActive({ transaction } = {}) {
    return this.get({ where: { is_active: true }, order: [['id', 'ASC']], transaction });
  }

  /**
   * For each of `workerIds`: whether they have a PENDING/CONFIRMED/COMPLETED booking
   * overlapping [start, end), and their total occupied hours within [dayStart, dayEnd).
   * COMPLETED bookings still count — that time genuinely happened. Only CANCELLED is
   * excluded. Workers with zero bookings still appear (has_overlap: false, booked_hours: 0).
   */
  async getAvailability(workerIds, { start, end, dayStart, dayEnd }, { transaction } = {}) {
    if (!workerIds.length) return [];

    const rows = await this.model.sequelize.query(
      `
      SELECT
        worker_id,
        BOOL_OR(status IN (:occupiedStatuses) AND start_time < :end AND end_time > :start) AS has_overlap,
        COALESCE(SUM(
          CASE WHEN status IN (:occupiedStatuses) AND start_time < :dayEnd AND end_time > :dayStart
          THEN EXTRACT(EPOCH FROM (LEAST(end_time, :dayEnd) - GREATEST(start_time, :dayStart))) / 3600.0
          ELSE 0 END
        ), 0) AS booked_hours
      FROM bookings
      WHERE worker_id IN (:workerIds)
      GROUP BY worker_id
      `,
      {
        replacements: { workerIds, start, end, dayStart, dayEnd, occupiedStatuses: OCCUPIED_BOOKING_STATUSES },
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
}
