import { describe, it, expect, afterEach } from '@jest/globals';
import { requireRole } from '#src/common/auth/require-role';
import { ROLES } from '#constants/role.const';
import { ForbiddenError } from '#configs/error';

describe('requireRole', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('no-ops (never throws) when auth is not enforced, regardless of role', async () => {
    delete process.env.NODE_ENV;
    const hook = requireRole(ROLES.ADMIN);

    await expect(hook({ user: { role: ROLES.CUSTOMER } })).resolves.toBeUndefined();
  });

  it('passes when the request role is in the allowed list', async () => {
    process.env.NODE_ENV = 'production';
    const hook = requireRole(ROLES.ADMIN, ROLES.WORKER);

    await expect(hook({ user: { role: ROLES.WORKER } })).resolves.toBeUndefined();
  });

  it('throws ForbiddenError when the request role is not in the allowed list', async () => {
    process.env.NODE_ENV = 'production';
    const hook = requireRole(ROLES.ADMIN);

    await expect(hook({ user: { role: ROLES.CUSTOMER } })).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when there is no user on the request', async () => {
    process.env.NODE_ENV = 'production';
    const hook = requireRole(ROLES.ADMIN);

    await expect(hook({})).rejects.toThrow(ForbiddenError);
  });
});
