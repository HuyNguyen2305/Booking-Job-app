import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { BaseRepository } = await import('#src/common/base/base.repository');
const { Worker } = await import('#models/worker.model');

describe('BaseRepository.update (integration)', () => {
  let rollback;
  const repository = new BaseRepository(Worker);

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('updates the matching row and returns the updated record', async () => {
    const ctx = await seedWithTransaction([
      { table: 'workers', rows: [{ id: 9201, name: 'Base Update Worker', is_active: true }] },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const updated = await repository.update({ id: 9201 }, { is_active: false }, { transaction });

      expect(updated).not.toBeNull();
      expect(updated.id).toBe(9201);
      expect(updated.is_active).toBe(false);
    });
  });

  it('returns null when the where clause matches no rows', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const updated = await repository.update({ id: 999999 }, { is_active: false }, { transaction });
      expect(updated).toBeNull();
    });
  });
});
