import { describe, it, expect, afterEach } from '@jest/globals';
import { isAuthEnforced } from '#src/common/auth/env';

describe('isAuthEnforced', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns false when NODE_ENV is unset', () => {
    delete process.env.NODE_ENV;
    expect(isAuthEnforced()).toBe(false);
  });

  it('returns false when NODE_ENV is "test" or "development"', () => {
    process.env.NODE_ENV = 'test';
    expect(isAuthEnforced()).toBe(false);
    process.env.NODE_ENV = 'development';
    expect(isAuthEnforced()).toBe(false);
  });

  it('returns true when NODE_ENV is "production"', () => {
    process.env.NODE_ENV = 'production';
    expect(isAuthEnforced()).toBe(true);
  });
});
