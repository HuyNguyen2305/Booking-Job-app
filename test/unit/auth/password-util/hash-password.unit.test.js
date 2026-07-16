import { describe, it, expect } from '@jest/globals';
import bcrypt from 'bcrypt';
import { hashPassword } from '#src/common/auth/password.util';

describe('hashPassword', () => {
  it('returns a bcrypt hash that is not the plaintext, and validates against it', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');

    expect(hash).not.toBe('correct-horse-battery-staple');
    await expect(bcrypt.compare('correct-horse-battery-staple', hash)).resolves.toBe(true);
  });
});
