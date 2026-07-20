import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { BaseRepository } = await import('#src/common/base/base.repository');
const { Worker } = await import('#models/worker.model');

describe('BaseRepository.bulkCreate (integration)', () => {
  let rollback;
  const repository = new BaseRepository(Worker);

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('inserts multiple rows in one call and returns all of them', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const rows = [
        { name: 'Base BulkCreate Worker A' },
        { name: 'Base BulkCreate Worker B' },
        { name: 'Base BulkCreate Worker C' },
      ];

      const created = await repository.bulkCreate(rows, { transaction });
      expect(created).toHaveLength(3);

      const stored = await repository.get({
        where: { id: created.map((w) => w.id) },
        transaction,
      });
      expect(stored.map((w) => w.name).sort()).toEqual([
        'Base BulkCreate Worker A',
        'Base BulkCreate Worker B',
        'Base BulkCreate Worker C',
      ]);
    });
  });
});
