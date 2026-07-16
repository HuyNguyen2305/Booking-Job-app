import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { signToken } from '#src/common/auth/jwt.util';

describe('signToken', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalExpiresIn = process.env.JWT_EXPIRES_IN;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    process.env.JWT_EXPIRES_IN = originalExpiresIn;
  });

  it('signs a token whose payload can be verified with the same secret', () => {
    const token = signToken({ id: 42, role: 'ADMIN' });

    const decoded = jwt.verify(token, 'test-secret');
    expect(decoded).toMatchObject({ id: 42, role: 'ADMIN' });
  });

  it('defaults to a 1d expiry when JWT_EXPIRES_IN is unset', () => {
    delete process.env.JWT_EXPIRES_IN;

    const token = signToken({ id: 1, role: 'ADMIN' });
    const decoded = jwt.verify(token, 'test-secret');

    expect(decoded.exp - decoded.iat).toBe(24 * 60 * 60);
  });
});
