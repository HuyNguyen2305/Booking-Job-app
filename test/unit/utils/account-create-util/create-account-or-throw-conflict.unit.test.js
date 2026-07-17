import { jest, describe, it, expect } from '@jest/globals';
import { UniqueConstraintError } from 'sequelize';
import { createAccountOrThrowConflict } from '#utils/account-create.util';
import { ConflictError } from '#configs/error';
import { ACCOUNT_ERROR_CODES } from '#constants/error-codes.const';

describe('AccountCreateUtil.createAccountOrThrowConflict', () => {
  it('returns the created row on success', async () => {
    const created = { id: 1, email: 'alice@example.com' };
    const repository = { create: jest.fn().mockResolvedValue(created) };

    const result = await createAccountOrThrowConflict(repository, { email: 'alice@example.com' });

    expect(result).toBe(created);
    expect(repository.create).toHaveBeenCalledWith({ email: 'alice@example.com' });
  });

  it('translates a unique-constraint violation into a 409 ConflictError with EMAIL_ALREADY_REGISTERED', async () => {
    const repository = { create: jest.fn().mockRejectedValue(new UniqueConstraintError({ message: 'duplicate' })) };

    await expect(createAccountOrThrowConflict(repository, {})).rejects.toBeInstanceOf(ConflictError);
    await expect(createAccountOrThrowConflict(repository, {})).rejects.toMatchObject({
      statusCode: 409,
      code: ACCOUNT_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
    });
  });

  it('rethrows any other error unchanged', async () => {
    const otherError = new Error('connection reset');
    const repository = { create: jest.fn().mockRejectedValue(otherError) };

    await expect(createAccountOrThrowConflict(repository, {})).rejects.toBe(otherError);
  });
});
