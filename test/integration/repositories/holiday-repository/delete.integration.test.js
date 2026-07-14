import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { HolidayRepository } = await import('#repositories/holiday.repository');

describe('HolidayRepository.delete (integration)', () => {
  let rollback;
  const repository = new HolidayRepository();
  const holidayId = '22222222-2222-2222-2222-222222222222';

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('actually removes the row from the database, not just the affected-row count', async () => {
    const ctx = await seedWithTransaction([
      {
        table: 'holidays',
        rows: [{ id: holidayId, holiday_date: '2027-04-30', name: 'Reunification Day', recurring_annual: false }],
      },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const before = await repository.getOne({ where: { id: holidayId }, transaction });
      expect(before).not.toBeNull();

      await repository.delete({ id: holidayId }, { transaction });

      // Independent re-read, not trusting the delete call's own return value, to prove
      // the row is genuinely gone from Postgres and not just uncounted.
      const after = await repository.getOne({ where: { id: holidayId }, transaction });
      expect(after).toBeNull();
    });
  });
});
