import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { BaseRepository } = await import('#src/common/base/base.repository');
const { Worker } = await import('#models/worker.model');

describe('BaseRepository.pagination (integration)', () => {
  let rollback;
  const repository = new BaseRepository(Worker);

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('defaults to page 1, limit 20', async () => {
    const ctx = await seedWithTransaction([
      {
        table: 'workers',
        rows: [
          { id: 9401, name: 'Base Pagination Worker 9401' },
          { id: 9402, name: 'Base Pagination Worker 9402' },
          { id: 9403, name: 'Base Pagination Worker 9403' },
        ],
      },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const result = await repository.pagination({
        where: { id: [9401, 9402, 9403] },
        order: [['id', 'ASC']],
        transaction,
      });

      expect(result.rows.map((w) => w.id)).toEqual([9401, 9402, 9403]);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.count).toBe(3);
      expect(result.totalPages).toBe(1);
    });
  });

  it('returns the correct slice and totalPages for an explicit page/limit', async () => {
    const ctx = await seedWithTransaction([
      {
        table: 'workers',
        rows: [
          { id: 9411, name: 'Base Pagination Worker 9411' },
          { id: 9412, name: 'Base Pagination Worker 9412' },
          { id: 9413, name: 'Base Pagination Worker 9413' },
        ],
      },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const result = await repository.pagination({
        where: { id: [9411, 9412, 9413] },
        order: [['id', 'ASC']],
        page: 2,
        limit: 1,
        transaction,
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(9412);
      expect(result.count).toBe(3);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(1);
      expect(result.totalPages).toBe(3);
    });
  });

  it('returns an empty page past the last one, without error', async () => {
    const ctx = await seedWithTransaction([
      { table: 'workers', rows: [{ id: 9421, name: 'Base Pagination Worker 9421' }] },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const result = await repository.pagination({ where: { id: 9421 }, page: 5, limit: 10, transaction });

      expect(result.rows).toEqual([]);
      expect(result.count).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });
});
