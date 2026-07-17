import { describe, it, expect } from '@jest/globals';
import { UniqueConstraintError } from 'sequelize';
import { isUniqueConstraintError } from '#utils/sequelize-error.util';

describe('SequelizeErrorUtil.isUniqueConstraintError', () => {
  it('returns true for a real Sequelize UniqueConstraintError instance', () => {
    expect(isUniqueConstraintError(new UniqueConstraintError({}))).toBe(true);
  });

  it('returns true when the error carries the Postgres 23505 code but is not the Sequelize class', () => {
    expect(isUniqueConstraintError({ parent: { code: '23505' } })).toBe(true);
  });

  it('returns false for an unrelated error', () => {
    expect(isUniqueConstraintError(new Error('boom'))).toBe(false);
  });

  it('returns false for a different Postgres error code', () => {
    expect(isUniqueConstraintError({ parent: { code: '23P01' } })).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isUniqueConstraintError(null)).toBe(false);
    expect(isUniqueConstraintError(undefined)).toBe(false);
  });
});
