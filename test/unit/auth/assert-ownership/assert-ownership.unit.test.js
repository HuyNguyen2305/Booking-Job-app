import { describe, it, expect, afterEach } from '@jest/globals';
import { assertOwnership } from '#src/common/auth/assert-ownership';
import { ROLES } from '#constants/role.const';
import { ForbiddenError } from '#configs/error';

describe('assertOwnership', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('never throws when auth is not enforced', () => {
    delete process.env.NODE_ENV;
    expect(() =>
      assertOwnership({ role: ROLES.CUSTOMER, id: 1 }, { role: ROLES.CUSTOMER, ownerId: 999 })
    ).not.toThrow();
  });

  it('never throws for an ADMIN, regardless of ownerId', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertOwnership({ role: ROLES.ADMIN, id: 1 }, { role: ROLES.CUSTOMER, ownerId: 999 })).not.toThrow();
  });

  it('passes when the user matches role and ownerId', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertOwnership({ role: ROLES.CUSTOMER, id: 5 }, { role: ROLES.CUSTOMER, ownerId: 5 })).not.toThrow();
  });

  it('throws ForbiddenError when the user id does not match ownerId', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertOwnership({ role: ROLES.CUSTOMER, id: 5 }, { role: ROLES.CUSTOMER, ownerId: 6 })).toThrow(
      ForbiddenError
    );
  });

  it('throws ForbiddenError when the user role does not match', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertOwnership({ role: ROLES.WORKER, id: 5 }, { role: ROLES.CUSTOMER, ownerId: 5 })).toThrow(
      ForbiddenError
    );
  });
});
