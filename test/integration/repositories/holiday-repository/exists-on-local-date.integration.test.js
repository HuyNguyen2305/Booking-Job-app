import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';
import fixtures from '#test/fixtures/holidays.fixture.cjs';

const { HolidayRepository } = await import('#repositories/holiday.repository');

describe('HolidayRepository.existsOnLocalDate (integration)', () => {
  let rollback;
  const repository = new HolidayRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('matches an exact-date, non-recurring holiday', async () => {
    const ctx = await seedWithTransaction([{ table: 'holidays', rows: [fixtures.exactChristmas] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      expect(await repository.existsOnLocalDate('2026-12-25', { transaction })).toBe(true);
      expect(await repository.existsOnLocalDate('2027-12-25', { transaction })).toBe(false);
    });
  });

  it('matches a recurring holiday by month/day across different years', async () => {
    const ctx = await seedWithTransaction([{ table: 'holidays', rows: [fixtures.recurringNewYear] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      expect(await repository.existsOnLocalDate('2026-01-01', { transaction })).toBe(true);
      expect(await repository.existsOnLocalDate('2030-01-01', { transaction })).toBe(true);
      expect(await repository.existsOnLocalDate('2026-01-02', { transaction })).toBe(false);
    });
  });

  it('returns false for a date with no matching holiday', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      expect(await repository.existsOnLocalDate('2026-05-05', { transaction })).toBe(false);
    });
  });
});
