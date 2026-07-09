import { REPOSITORY_KEYS } from '#constants/singleton';
import {
  BOOKING_STATUS,
  BOOKING_STATUS_TRANSITIONS,
  MIN_BOOKING_DURATION_MINUTES,
} from '#constants/booking-status.const';
import { ValidationError, ConflictError, NotFoundError } from '#configs/error';
import { isAtLeastMinutesApart } from '#utils/date.util';
import { sequelize } from '#models/index';

export class BookingService {
  constructor({ container }) {
    this.bookingRepository = container.resolve(REPOSITORY_KEYS.BOOKING);
  }

  async createBooking({ worker_id, customer_id, start_time, end_time }) {
    if (!isAtLeastMinutesApart(start_time, end_time, MIN_BOOKING_DURATION_MINUTES)) {
      throw new ValidationError(`end_time must be at least ${MIN_BOOKING_DURATION_MINUTES} minutes after start_time`);
    }

    return sequelize.transaction(async (transaction) => {
      const overlap = await this.bookingRepository.findOverlappingForWorker(worker_id, start_time, end_time, {
        transaction,
      });
      if (overlap) {
        throw new ConflictError('Worker already has a booking that overlaps this time range');
      }

      return this.bookingRepository.create(
        { worker_id, customer_id, start_time, end_time, status: BOOKING_STATUS.PENDING },
        { transaction }
      );
    });
  }

  async updateStatus(id, nextStatus) {
    const booking = await this.bookingRepository.getOne({ where: { id } });
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const allowed = BOOKING_STATUS_TRANSITIONS[booking.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new ConflictError(`Cannot transition booking from ${booking.status} to ${nextStatus}`);
    }

    return this.bookingRepository.update({ id }, { status: nextStatus });
  }

  async listByWorker(workerId, { from, to } = {}) {
    return this.bookingRepository.listByWorker(workerId, { from, to });
  }
}
