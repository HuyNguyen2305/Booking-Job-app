import { DateTime } from 'luxon';
import { REPOSITORY_KEYS } from '#constants/singleton';
import { ValidationError, NotFoundError } from '#configs/error';

const MAX_HOLIDAY_RANGE_DAYS = 366;

export class HolidayService {
  constructor({ container }) {
    this.holidayRepository = container.resolve(REPOSITORY_KEYS.HOLIDAY);
  }

  async create({ holiday_date, name, recurring_annual }) {
    return this.holidayRepository.create({ holiday_date, name, recurring_annual });
  }

  /**
   * Creates one holiday row per calendar day in [start_date, end_date] inclusive, all
   * sharing the same name/recurring_annual — e.g. a multi-day holiday like Tet. The
   * `holidays` table stays one-row-per-day (no schema change), so `existsOnLocalDate`
   * needs no changes: a multi-day holiday is just several ordinary rows that happen to
   * share a name.
   */
  async createRange({ name, start_date, end_date, recurring_annual }) {
    const start = DateTime.fromISO(start_date);
    const end = DateTime.fromISO(end_date);
    if (!start.isValid || !end.isValid) {
      throw new ValidationError('start_date/end_date must be valid ISO 8601 dates');
    }
    if (end < start) {
      throw new ValidationError('end_date must not be before start_date');
    }

    const totalDays = end.diff(start, 'days').days + 1;
    if (totalDays > MAX_HOLIDAY_RANGE_DAYS) {
      throw new ValidationError(`Holiday range cannot span more than ${MAX_HOLIDAY_RANGE_DAYS} days`);
    }

    const rows = [];
    for (let day = start; day <= end; day = day.plus({ days: 1 })) {
      rows.push({ holiday_date: day.toISODate(), name, recurring_annual });
    }

    return this.holidayRepository.bulkCreate(rows);
  }

  async list() {
    return this.holidayRepository.get({ order: [['holiday_date', 'ASC']] });
  }

  async remove(id) {
    const holiday = await this.holidayRepository.getOne({ where: { id } });
    if (!holiday) {
      throw new NotFoundError('Holiday not found');
    }
    await this.holidayRepository.delete({ id });
    return holiday;
  }
}
