import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { HolidayRepository } = await import('#repositories/holiday.repository');

describe('HolidayRepository.bulkCreate (integration)', () => {
  let rollback;
  const repository = new HolidayRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('inserts one row per given date, all sharing the same name', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const rows = [
        { holiday_date: '2027-02-06', name: 'Tet Holiday', recurring_annual: false },
        { holiday_date: '2027-02-07', name: 'Tet Holiday', recurring_annual: false },
        { holiday_date: '2027-02-08', name: 'Tet Holiday', recurring_annual: false },
      ];

      const created = await repository.bulkCreate(rows, { transaction });
      expect(created).toHaveLength(3);

      const stored = await repository.get({
        where: { holiday_date: ['2027-02-06', '2027-02-07', '2027-02-08'] },
        transaction,
      });
      expect(stored).toHaveLength(3);
      expect(stored.every((h) => h.name === 'Tet Holiday')).toBe(true);
    });
  });
});
