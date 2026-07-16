import fp from 'fastify-plugin';
import { isAuthEnforced } from '#src/common/auth/env';
import { verifyToken } from '#src/common/auth/jwt.util';
import { ROLES } from '#constants/role.const';
import { UnauthorizedError } from '#configs/error';

async function authenticatePlugin(fastify) {
  fastify.decorate('authenticate', async function authenticate(request) {
    if (!isAuthEnforced()) {
      // Blanket dev/Swagger bypass: attach a synthetic all-powerful identity so
      // ownership checks downstream never need a separate bypass branch of their own.
      request.user = { id: null, role: ROLES.ADMIN };
      return;
    }

    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      throw new UnauthorizedError('Missing bearer token');
    }

    try {
      request.user = verifyToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  });
}

export default fp(authenticatePlugin);
