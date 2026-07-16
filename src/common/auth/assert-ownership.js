import { isAuthEnforced } from '#src/common/auth/env';
import { ROLES } from '#constants/role.const';
import { ForbiddenError } from '#configs/error';

/** Asserts `user` is either an ADMIN or the single named owner of a resource. */
export function assertOwnership(user, { role, ownerId }) {
  assertOwnershipAny(user, [{ role, ownerId }]);
}

/**
 * Asserts `user` is either an ADMIN, or matches at least one of the given
 * {role, ownerId} candidates — e.g. a booking is "owned" by both its worker and its
 * customer, either of whom may act on it, but a worker may not act on someone else's.
 */
export function assertOwnershipAny(user, candidates) {
  if (!isAuthEnforced() || user?.role === ROLES.ADMIN) return;

  const isOwner = candidates.some(({ role, ownerId }) => user?.role === role && user?.id === ownerId);
  if (!isOwner) {
    throw new ForbiddenError('You do not have access to this resource');
  }
}
