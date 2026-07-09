import { Op } from 'sequelize';
import { BaseRepository } from '#src/common/base/base.repository';
import { Booking } from '#models/booking.model';
import { ACTIVE_BOOKING_STATUSES } from '#constants/booking-status.const';

export class BookingRepository extends BaseRepository {
  constructor() {
    super(Booking);
  }

  async findOverlappingForWorker(workerId, startTime, endTime, { excludeId, transaction } = {}) {
    const where = {
      worker_id: workerId,
      status: { [Op.in]: ACTIVE_BOOKING_STATUSES },
      start_time: { [Op.lt]: endTime },
      end_time: { [Op.gt]: startTime },
    };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    return this.getOne({ where, transaction });
  }

  async listByWorker(workerId, { from, to, transaction } = {}) {
    const where = { worker_id: workerId };
    if (from) where.end_time = { [Op.gt]: from };
    if (to) where.start_time = { [Op.lt]: to };
    return this.get({ where, order: [['start_time', 'ASC']], transaction });
  }
}
