import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { WorkerRepository } = await import('#repositories/worker.repository');

describe('WorkerRepository.incrementTotalHours (integration)', () => {
  let rollback;
  const repository = new WorkerRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it("adds the given hours on top of the worker's existing total_hours", async () => {
    const ctx = await seedWithTransaction([
      { table: 'workers', rows: [{ id: 7001, name: 'Worker 7001', is_active: true, total_hours: 10 }] },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      await repository.incrementTotalHours(7001, 2.5, { transaction });

      const worker = await repository.getOne({ where: { id: 7001 }, transaction });
      expect(worker.total_hours).toBe(12.5);
    });
  });

  it('accumulates correctly across multiple increments', async () => {
    const ctx = await seedWithTransaction([
      { table: 'workers', rows: [{ id: 7001, name: 'Worker 7001', is_active: true, total_hours: 0 }] },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      await repository.incrementTotalHours(7001, 1.5, { transaction });
      await repository.incrementTotalHours(7001, 2, { transaction });

      const worker = await repository.getOne({ where: { id: 7001 }, transaction });
      expect(worker.total_hours).toBe(3.5);
    });
  });
});
