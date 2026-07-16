import { isAuthEnforced } from '#src/common/auth/env';
import { ForbiddenError } from '#configs/error';

export function requireRole(...roles) {
  return async function requireRoleHook(request) {
    if (!isAuthEnforced()) return;
    if (!roles.includes(request.user?.role)) {
      throw new ForbiddenError('Insufficient role');
    }
  };
}
