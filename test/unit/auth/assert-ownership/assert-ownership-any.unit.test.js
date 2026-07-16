import { describe, it, expect, afterEach } from '@jest/globals';
import { assertOwnershipAny } from '#src/common/auth/assert-ownership';
import { ROLES } from '#constants/role.const';
import { ForbiddenError } from '#configs/error';

describe('assertOwnershipAny', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('never throws when auth is not enforced', () => {
    delete process.env.NODE_ENV;
    expect(() =>
      assertOwnershipAny({ role: ROLES.CUSTOMER, id: 1 }, [{ role: ROLES.CUSTOMER, ownerId: 999 }])
    ).not.toThrow();
  });

  it('passes when the user matches any one of the candidates (e.g. the worker on a booking)', () => {
    process.env.NODE_ENV = 'production';
    expect(() =>
      assertOwnershipAny({ role: ROLES.WORKER, id: 3 }, [
        { role: ROLES.WORKER, ownerId: 3 },
        { role: ROLES.CUSTOMER, ownerId: 99 },
      ])
    ).not.toThrow();
  });

  it('passes when the user matches the other candidate (e.g. the customer on the same booking)', () => {
    process.env.NODE_ENV = 'production';
    expect(() =>
      assertOwnershipAny({ role: ROLES.CUSTOMER, id: 99 }, [
        { role: ROLES.WORKER, ownerId: 3 },
        { role: ROLES.CUSTOMER, ownerId: 99 },
      ])
    ).not.toThrow();
  });

  it('throws ForbiddenError when the user matches none of the candidates', () => {
    process.env.NODE_ENV = 'production';
    expect(() =>
      assertOwnershipAny({ role: ROLES.WORKER, id: 7 }, [
        { role: ROLES.WORKER, ownerId: 3 },
        { role: ROLES.CUSTOMER, ownerId: 99 },
      ])
    ).toThrow(ForbiddenError);
  });
});
