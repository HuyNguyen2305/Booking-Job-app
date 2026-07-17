import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { BaseRepository } = await import('#src/common/base/base.repository');
const { Worker } = await import('#models/worker.model');

describe('BaseRepository.get (integration)', () => {
  let rollback;
  const repository = new BaseRepository(Worker);

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('returns every row matching the where clause', async () => {
    const ctx = await seedWithTransaction([
      {
        table: 'workers',
        rows: [
          { id: 9001, name: 'Base Get Worker 9001', is_active: true },
          { id: 9002, name: 'Base Get Worker 9002', is_active: false },
          { id: 9003, name: 'Base Get Worker 9003', is_active: true },
        ],
      },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const result = await repository.get({ where: { id: [9001, 9002, 9003], is_active: true }, transaction });

      expect(result.map((w) => w.id).sort()).toEqual([9001, 9003]);
    });
  });

  it('respects order, limit, and offset', async () => {
    const ctx = await seedWithTransaction([
      {
        table: 'workers',
        rows: [
          { id: 9011, name: 'Base Get Worker 9011', is_active: true },
          { id: 9012, name: 'Base Get Worker 9012', is_active: true },
          { id: 9013, name: 'Base Get Worker 9013', is_active: true },
        ],
      },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const result = await repository.get({
        where: { id: [9011, 9012, 9013] },
        order: [['id', 'DESC']],
        limit: 2,
        offset: 1,
        transaction,
      });

      expect(result.map((w) => w.id)).toEqual([9012, 9011]);
    });
  });

  it('returns an empty array when nothing matches', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const result = await repository.get({ where: { id: 999999 }, transaction });
      expect(result).toEqual([]);
    });
  });
});
