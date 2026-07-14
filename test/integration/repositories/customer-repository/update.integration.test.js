import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { CustomerRepository } = await import('#repositories/customer.repository');

describe('CustomerRepository.update (integration)', () => {
  let rollback;
  const repository = new CustomerRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('updates the name of an existing customer and returns the updated record', async () => {
    const ctx = await seedWithTransaction([{ table: 'customers', rows: [{ id: 8001, name: 'Alice' }] }]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const updated = await repository.update({ id: 8001 }, { name: 'Bob' }, { transaction });

      expect(updated).not.toBeNull();
      expect(updated.name).toBe('Bob');
    });
  });

  it('returns null when the where clause matches no rows', async () => {
    const ctx = await seedWithTransaction([]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const updated = await repository.update({ id: 999999 }, { name: 'Bob' }, { transaction });
      expect(updated).toBeNull();
    });
  });
});
