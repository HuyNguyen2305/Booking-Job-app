import { describe, it, expect } from '@jest/globals';
import bcrypt from 'bcrypt';
import { verifyPassword } from '#src/common/auth/password.util';

describe('verifyPassword', () => {
  it('resolves true for the matching plaintext', async () => {
    const hash = await bcrypt.hash('secret', 4);
    await expect(verifyPassword('secret', hash)).resolves.toBe(true);
  });

  it('resolves false for a non-matching plaintext', async () => {
    const hash = await bcrypt.hash('secret', 4);
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });
});
