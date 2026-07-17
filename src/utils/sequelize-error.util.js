import { ExclusionConstraintError, UniqueConstraintError } from 'sequelize';

export function isExclusionConstraintError(err) {
  return err instanceof ExclusionConstraintError || err?.parent?.code === '23P01';
}

export function isUniqueConstraintError(err) {
  return err instanceof UniqueConstraintError || err?.parent?.code === '23505';
}
