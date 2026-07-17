import { Op } from 'sequelize';
import { BaseRepository } from '#src/common/base/base.repository';
import { Booking } from '#models/booking.model';
import {
  OCCUPIED_BOOKING_STATUSES,
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUS,
} from '#constants/booking-status.const';

export class BookingRepository extends BaseRepository {
  constructor() {
    super(Booking);
  }

  async findOverlappingForWorker(workerId, startTime, endTime, { excludeId, transaction } = {}) {
    const where = {
      worker_id: workerId,
      status: { [Op.in]: OCCUPIED_BOOKING_STATUSES },
      start_time: { [Op.lt]: endTime },
      end_time: { [Op.gt]: startTime },
    };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    return this.getOne({ where, transaction });
  }

  async listByWorker(workerId, { from, to, page, limit, transaction } = {}) {
    const where = { worker_id: workerId };
    if (from) where.end_time = { [Op.gt]: from };
    if (to) where.start_time = { [Op.lt]: to };
    return this.pagination({ where, order: [['start_time', 'ASC']], page, limit, transaction });
  }

  async listByCustomer(customerId, { from, to, page, limit, transaction } = {}) {
    const where = { customer_id: customerId };
    if (from) where.end_time = { [Op.gt]: from };
    if (to) where.start_time = { [Op.lt]: to };
    return this.pagination({ where, order: [['start_time', 'ASC']], page, limit, transaction });
  }

  /** This worker's still-open (PENDING/CONFIRMED) bookings that haven't started yet. */
  async listReassignableForWorker(workerId, { transaction } = {}) {
    return this.get({
      where: {
        worker_id: workerId,
        status: { [Op.in]: ACTIVE_BOOKING_STATUSES },
        start_time: { [Op.gt]: new Date() },
      },
      order: [['start_time', 'ASC']],
      transaction,
    });
  }

  /** CONFIRMED bookings whose end_time has already passed — candidates for auto-completion. */
  async listPastConfirmed({ transaction } = {}) {
    return this.get({
      where: { status: BOOKING_STATUS.CONFIRMED, end_time: { [Op.lt]: new Date() } },
      transaction,
    });
  }

  /** This customer's still-open (PENDING/CONFIRMED) bookings, any time — for deletion cleanup. */
  async listActiveForCustomer(customerId, { transaction } = {}) {
    return this.get({
      where: { customer_id: customerId, status: { [Op.in]: ACTIVE_BOOKING_STATUSES } },
      transaction,
    });
  }

  /**
   * Compare-and-swap status update: only writes if the row's status still matches
   * `fromStatus` at write time. Returns null (not the stale row) if another transaction
   * already changed it — callers must treat null as "lost the race," not "not found."
   * Re-fetches by id only (not by the old status) since BaseRepository.update's
   * re-fetch-by-original-where would incorrectly report failure on a real, successful
   * status change (the row no longer matches `status: fromStatus` after the write).
   */
  async updateStatusIfUnchanged(id, fromStatus, toStatus, { transaction } = {}) {
    const [affected] = await this.model.update(
      { status: toStatus },
      { where: { id, status: fromStatus }, transaction }
    );
    if (affected === 0) return null;
    return this.getOne({ where: { id }, transaction });
  }
}
