import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { BaseRepository } = await import('#src/common/base/base.repository');
const { Worker } = await import('#models/worker.model');

describe('BaseRepository.getOne (integration)', () => {
  let rollback;
  const repository = new BaseRepository(Worker);

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('returns the single row matching the where clause', async () => {
    const ctx = await seedWithTransaction([{ table: 'workers', rows: [{ id: 9101, name: 'Base GetOne Worker 9101' }] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const result = await repository.getOne({ where: { id: 9101 }, transaction });

      expect(result).not.toBeNull();
      expect(result.id).toBe(9101);
      expect(result.name).toBe('Base GetOne Worker 9101');
    });
  });

  it('returns null when nothing matches', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const result = await repository.getOne({ where: { id: 999999 }, transaction });
      expect(result).toBeNull();
    });
  });
});
