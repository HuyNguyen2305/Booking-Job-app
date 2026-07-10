import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';
import workerFixtures from '#test/fixtures/workers.fixture.cjs';

const { WorkerRepository } = await import('#repositories/worker.repository');

describe('WorkerRepository.listActive (integration)', () => {
  let rollback;
  const repository = new WorkerRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  // Scoped to the fixture's own id range (7001-7010) rather than the whole table,
  // since other integration suites (e.g. the concurrency test) commit real worker
  // rows outside the rollback pattern and may run concurrently in another worker process.
  it('returns only is_active workers from the fixture, ordered by id ascending', async () => {
    const ctx = await seedWithTransaction([{ table: 'workers', rows: workerFixtures.workers }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const workers = await repository.listActive({ transaction });
      const fixtureWorkers = workers.filter((w) => w.id >= 7001 && w.id <= 7010);

      expect(fixtureWorkers).toHaveLength(9);
      expect(fixtureWorkers.map((w) => w.id)).not.toContain(7010);
      expect(fixtureWorkers.map((w) => w.id)).toEqual([...fixtureWorkers.map((w) => w.id)].sort((a, b) => a - b));
    });
  });

  it('excludes an inactive worker that was the only row seeded', async () => {
    const ctx = await seedWithTransaction([{ table: 'workers', rows: [workerFixtures.workers[9]] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const workers = await repository.listActive({ transaction });
      expect(workers.map((w) => w.id)).not.toContain(7010);
    });
  });
});
