import { REPOSITORY_KEYS } from '#constants/singleton';
import { NotFoundError } from '#configs/error';

export class HolidayService {
  constructor({ container }) {
    this.holidayRepository = container.resolve(REPOSITORY_KEYS.HOLIDAY);
  }

  async create({ holiday_date, name, recurring_annual }) {
    return this.holidayRepository.create({ holiday_date, name, recurring_annual });
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
