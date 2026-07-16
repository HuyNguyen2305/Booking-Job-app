import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { verifyToken } from '#src/common/auth/jwt.util';

describe('verifyToken', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('returns the decoded payload for a validly signed token', () => {
    const token = jwt.sign({ id: 7, role: 'WORKER' }, 'test-secret');

    const decoded = verifyToken(token);

    expect(decoded).toMatchObject({ id: 7, role: 'WORKER' });
  });

  it('throws for a token signed with a different secret', () => {
    const token = jwt.sign({ id: 7, role: 'WORKER' }, 'wrong-secret');

    expect(() => verifyToken(token)).toThrow();
  });

  it('throws for a malformed token', () => {
    expect(() => verifyToken('not-a-real-token')).toThrow();
  });

  it('throws for an expired token', () => {
    const token = jwt.sign({ id: 7, role: 'WORKER' }, 'test-secret', { expiresIn: -10 });

    expect(() => verifyToken(token)).toThrow();
  });
});
