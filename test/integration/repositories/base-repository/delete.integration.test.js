import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { BaseRepository } = await import('#src/common/base/base.repository');
const { Worker } = await import('#models/worker.model');

describe('BaseRepository.delete (integration)', () => {
  let rollback;
  const repository = new BaseRepository(Worker);

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('actually removes the row from the database and returns the affected count', async () => {
    const ctx = await seedWithTransaction([{ table: 'workers', rows: [{ id: 9301, name: 'Base Delete Worker' }] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const affected = await repository.delete({ id: 9301 }, { transaction });
      expect(affected).toBe(1);

      // Independent re-read, not trusting the delete call's own return value, to prove
      // the row is genuinely gone from Postgres and not just uncounted.
      const after = await repository.getOne({ where: { id: 9301 }, transaction });
      expect(after).toBeNull();
    });
  });

  it('returns 0 when the where clause matches no rows', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const affected = await repository.delete({ id: 999999 }, { transaction });
      expect(affected).toBe(0);
    });
  });
});
