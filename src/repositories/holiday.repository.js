import { Op, where, fn, literal } from 'sequelize';
import { BaseRepository } from '#src/common/base/base.repository';
import { Holiday } from '#models/holiday.model';

export class HolidayRepository extends BaseRepository {
  constructor() {
    super(Holiday);
  }

  /** isoDate: 'YYYY-MM-DD' business-local calendar date. */
  async existsOnLocalDate(isoDate, { transaction } = {}) {
    const [, month, day] = isoDate.split('-').map(Number);
    const match = await this.getOne({
      where: {
        [Op.or]: [
          { holiday_date: isoDate, recurring_annual: false },
          {
            recurring_annual: true,
            [Op.and]: [
              where(fn('EXTRACT', literal('MONTH FROM holiday_date')), month),
              where(fn('EXTRACT', literal('DAY FROM holiday_date')), day),
            ],
          },
        ],
      },
      transaction,
    });
    return Boolean(match);
  }
}
