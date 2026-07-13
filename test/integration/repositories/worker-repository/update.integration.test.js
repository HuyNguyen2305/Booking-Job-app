import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';
import workerFixtures from '#test/fixtures/workers.fixture.cjs';

const { WorkerRepository } = await import('#repositories/worker.repository');

describe('WorkerRepository.update (integration)', () => {
  let rollback;
  const repository = new WorkerRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('deactivates an existing worker and returns the updated record', async () => {
    const ctx = await seedWithTransaction([{ table: 'workers', rows: [workerFixtures.workers[0]] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const updated = await repository.update(
        { id: workerFixtures.workers[0].id },
        { is_active: false },
        { transaction }
      );

      expect(updated).not.toBeNull();
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
