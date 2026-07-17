import { ConflictError } from '#configs/error';
import { ACCOUNT_ERROR_CODES } from '#constants/error-codes.const';
import { isUniqueConstraintError } from '#utils/sequelize-error.util';

/**
 * Creates a row via `repository.create(data)`, translating a duplicate-email unique-
 * constraint violation into a clean 409 ConflictError instead of letting the raw
 * SequelizeUniqueConstraintError propagate as an opaque 500. Shared by the three
 * "account" services (Admin/Customer/Worker) that each have a unique `email` column —
 * see `buildAccountSearchWhere` in account-search.util.js for the same three-table
 * grouping applied to search.
 */
export async function createAccountOrThrowConflict(repository, data) {
  try {
    return await repository.create(data);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ConflictError('Email already registered', { code: ACCOUNT_ERROR_CODES.EMAIL_ALREADY_REGISTERED });
    }
    throw err;
  }
}
