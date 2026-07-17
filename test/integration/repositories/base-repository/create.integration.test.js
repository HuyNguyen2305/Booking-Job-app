import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { BaseRepository } = await import('#src/common/base/base.repository');
const { Worker } = await import('#models/worker.model');

describe('BaseRepository.create (integration)', () => {
  let rollback;
  const repository = new BaseRepository(Worker);

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('creates and returns a new row', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const created = await repository.create({ name: 'Base Create Worker' }, { transaction });

      expect(created.id).toBeDefined();
      expect(created.name).toBe('Base Create Worker');
      // Model defaults apply even though not supplied explicitly.
      expect(created.is_active).toBe(true);

      const stored = await repository.getOne({ where: { id: created.id }, transaction });
      expect(stored.name).toBe('Base Create Worker');
    });
  });
});
