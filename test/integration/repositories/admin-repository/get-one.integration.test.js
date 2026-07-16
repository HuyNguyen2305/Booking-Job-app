import { describe, it, expect, afterEach } from '@jest/globals';
import { seedWithTransaction } from '#test/helpers/seed-fixtures.js';

const { AdminRepository } = await import('#repositories/admin.repository');

describe('AdminRepository.getOne (integration)', () => {
  let rollback;
  const repository = new AdminRepository();

  afterEach(async () => {
    if (rollback) await rollback();
    rollback = undefined;
  });

  it('finds a seeded admin by email', async () => {
    const ctx = await seedWithTransaction([
      {
        table: 'admins',
        rows: [{ id: 9001, name: 'Root', email: 'root-9001@example.com', password_hash: 'hashed' }],
      },
    ]);
    rollback = ctx.rollback;

    await ctx.run(async (transaction) => {
      const admin = await repository.getOne({ where: { email: 'root-9001@example.com' }, transaction });

      expect(admin.id).toBe(9001);
      expect(admin.name).toBe('Root');
      expect(admin.is_active).toBe(true);
    });
  });

  it('returns null when no admin matches the email', async () => {
    const admin = await repository.getOne({ where: { email: 'no-such-admin@example.com' } });
    expect(admin).toBeNull();
  });
});
