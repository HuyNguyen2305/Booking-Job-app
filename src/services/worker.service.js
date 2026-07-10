import { REPOSITORY_KEYS } from '#constants/singleton';
import { ValidationError } from '#configs/error';
import { BOOKING_ERROR_CODES } from '#constants/error-codes.const';
import { BUSINESS_TZ } from '#constants/business-hours.const';
import { parseTimestampWithOffset, toBusinessLocalDayBoundsUtc } from '#utils/date.util';
import { rankAvailableWorkers } from '#utils/worker-availability.util';

export class WorkerService {
  constructor({ container }) {
    this.workerRepository = container.resolve(REPOSITORY_KEYS.WORKER);
  }

  async listAvailable({ start, end }) {
    if (!parseTimestampWithOffset(start) || !parseTimestampWithOffset(end)) {
      throw new ValidationError('start/end must be ISO 8601 date-times with an explicit UTC offset', {
        code: BOOKING_ERROR_CODES.INVALID_TIMESTAMP_FORMAT,
      });
    }

    const activeWorkers = await this.workerRepository.listActive();
    const workerIds = activeWorkers.map((worker) => worker.id);
    const { dayStart, dayEnd } = toBusinessLocalDayBoundsUtc(start, BUSINESS_TZ);
    const rows = await this.workerRepository.getAvailability(workerIds, { start, end, dayStart, dayEnd });
    return rankAvailableWorkers(rows);
  }

  async register({ name }) {
    return this.workerRepository.create({ name });
  }

  async list() {
    return this.workerRepository.get({ order: [['id', 'ASC']] });
  }
}
