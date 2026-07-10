import { describe, it, expect } from '@jest/globals';
import { ExclusionConstraintError } from 'sequelize';
import { isExclusionConstraintError } from '#utils/sequelize-error.util';

describe('SequelizeErrorUtil.isExclusionConstraintError', () => {
  it('returns true for a real Sequelize ExclusionConstraintError instance', () => {
    expect(isExclusionConstraintError(new ExclusionConstraintError({}))).toBe(true);
  });

  it('returns true when the error carries the Postgres 23P01 code but is not the Sequelize class', () => {
    expect(isExclusionConstraintError({ parent: { code: '23P01' } })).toBe(true);
  });

  it('returns false for an unrelated error', () => {
    expect(isExclusionConstraintError(new Error('boom'))).toBe(false);
  });

  it('returns false for a different Postgres error code', () => {
    expect(isExclusionConstraintError({ parent: { code: '23505' } })).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isExclusionConstraintError(null)).toBe(false);
    expect(isExclusionConstraintError(undefined)).toBe(false);
  });
});
