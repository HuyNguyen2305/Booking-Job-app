import { ExclusionConstraintError } from 'sequelize';

export function isExclusionConstraintError(err) {
  return err instanceof ExclusionConstraintError || err?.parent?.code === '23P01';
}
