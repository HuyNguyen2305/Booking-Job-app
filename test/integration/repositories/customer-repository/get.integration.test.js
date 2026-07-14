import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { CustomerRepository } = await import('#repositories/customer.repository');

describe('CustomerRepository.get (integration)', () => {
  let rollback;
  const repository = new CustomerRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('returns seeded customers ordered by id ascending', async () => {
    const ctx = await seedWithTransaction([
      {
        table: 'customers',
        rows: [
          { id: 8002, name: 'Bob' },
          { id: 8001, name: 'Alice' },
        ],
      },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const customers = await repository.get({ order: [['id', 'ASC']], transaction });
      const fixtureCustomers = customers.filter((c) => c.id === 8001 || c.id === 8002);

      expect(fixtureCustomers.map((c) => c.id)).toEqual([8001, 8002]);
    });
  });
});
