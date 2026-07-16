import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { CustomerRepository } = await import('#repositories/customer.repository');

describe('CustomerRepository.pagination (integration)', () => {
  let rollback;
  const repository = new CustomerRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('defaults to page 1, limit 20, and reports the correct count/totalPages', async () => {
    const ctx = await seedWithTransaction([
      {
        table: 'customers',
        rows: [
          { id: 8101, name: 'Customer 8101' },
          { id: 8102, name: 'Customer 8102' },
          { id: 8103, name: 'Customer 8103' },
        ],
      },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const result = await repository.pagination({ order: [['id', 'ASC']], transaction });
      const fixtureRows = result.rows.filter((c) => [8101, 8102, 8103].includes(c.id));

      expect(fixtureRows.map((c) => c.id)).toEqual([8101, 8102, 8103]);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  it('returns the correct slice and totalPages for an explicit page/limit', async () => {
    const ctx = await seedWithTransaction([
      {
        table: 'customers',
        rows: [
          { id: 8201, name: 'Customer 8201' },
          { id: 8202, name: 'Customer 8202' },
          { id: 8203, name: 'Customer 8203' },
        ],
      },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const result = await repository.pagination({
        where: { id: [8201, 8202, 8203] },
        order: [['id', 'ASC']],
        page: 2,
        limit: 1,
        transaction,
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(8202);
      expect(result.count).toBe(3);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(1);
      expect(result.totalPages).toBe(3);
    });
  });

  it('returns an empty page past the last one, without error', async () => {
    const ctx = await seedWithTransaction([{ table: 'customers', rows: [{ id: 8301, name: 'Customer 8301' }] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const result = await repository.pagination({
        where: { id: 8301 },
        page: 5,
        limit: 10,
        transaction,
      });

      expect(result.rows).toEqual([]);
      expect(result.count).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });
});
