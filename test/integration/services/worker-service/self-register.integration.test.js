import { describe, it, expect, afterEach } from '@jest/globals';

const { WorkerRepository } = await import('#repositories/worker.repository');
const { WorkerService } = await import('#services/worker.service');
const { Worker } = await import('#models/worker.model');
const { ConflictError } = await import('#configs/error');
const { ACCOUNT_ERROR_CODES } = await import('#constants/error-codes.const');

/**
 * Real committed rows, not seedWithTransaction — the point of this test is a genuine
 * Postgres unique-constraint violation on a second insert, which needs the first row to
 * have actually committed first.
 */
describe('WorkerService.selfRegister (integration)', () => {
  let workerIds = [];

  afterEach(async () => {
    if (workerIds.length) {
      await Worker.destroy({ where: { id: workerIds } });
      workerIds = [];
    }
  });

  function buildService() {
    const workerService = Object.create(WorkerService.prototype);
    workerService.workerRepository = new WorkerRepository();
    return workerService;
  }

  it('creates the worker inactive', async () => {
    const workerService = buildService();
    const email = `self-register-${Date.now()}@example.com`;

    const created = await workerService.selfRegister({ name: 'Self Registered', email, password: 'secret' });
    workerIds.push(created.id);

    expect(created.is_active).toBe(false);
    const row = await Worker.findOne({ where: { id: created.id } });
    expect(row.is_active).toBe(false);
  });

  it('registering the same email twice throws ConflictError with EMAIL_ALREADY_REGISTERED instead of a raw DB error', async () => {
    const workerService = buildService();
    const email = `duplicate-self-register-${Date.now()}@example.com`;

    const first = await workerService.selfRegister({ name: 'First', email, password: 'secret' });
    workerIds.push(first.id);

    await expect(
      workerService.selfRegister({ name: 'Second', email, password: 'secret' })
    ).rejects.toMatchObject({
      code: ACCOUNT_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
    });
    await expect(
      workerService.selfRegister({ name: 'Second', email, password: 'secret' })
    ).rejects.toBeInstanceOf(ConflictError);

    // Confirm no stray second row was left behind by the failed attempt.
    const matching = await Worker.findAll({ where: { email } });
    expect(matching).toHaveLength(1);
  });
});
