import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { CustomerRepository } = await import('#repositories/customer.repository');

describe('CustomerRepository.create (integration)', () => {
  let rollback;
  const repository = new CustomerRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('inserts a customer row and returns it with the given name', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const customer = await repository.create({ name: 'Alice' }, { transaction });

      expect(customer.name).toBe('Alice');
      expect(customer.id).toEqual(expect.any(Number));
    });
  });
});
