import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import authenticatePlugin from '#src/common/auth/authenticate.plugin';
import { ROLES } from '#constants/role.const';
import { UnauthorizedError } from '#configs/error';

describe('authenticate', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;
  let authenticate;

  beforeAll(async () => {
    const fakeFastify = {
      decorate: (name, fn) => {
        if (name === 'authenticate') authenticate = fn;
      },
    };
    await authenticatePlugin(fakeFastify);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalSecret;
  });

  it('attaches a synthetic all-powerful ADMIN identity when auth is not enforced', async () => {
    delete process.env.NODE_ENV;
    const request = { headers: {} };

    await authenticate(request);

    expect(request.user).toEqual({ id: null, role: ROLES.ADMIN });
  });

  it('throws UnauthorizedError when enforced and no bearer token is provided', async () => {
    process.env.NODE_ENV = 'production';
    const request = { headers: {} };

    await expect(authenticate(request)).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when enforced and the token is invalid', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret';
    const request = { headers: { authorization: 'Bearer not-a-real-token' } };

    await expect(authenticate(request)).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when enforced and the token has expired', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret';
    const token = jwt.sign({ id: 5, role: ROLES.WORKER }, 'test-secret', { expiresIn: -10 });
    const request = { headers: { authorization: `Bearer ${token}` } };

    await expect(authenticate(request)).rejects.toThrow(UnauthorizedError);
  });

  it('populates request.user from a valid token when enforced', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret';
    const token = jwt.sign({ id: 5, role: ROLES.WORKER }, 'test-secret');
    const request = { headers: { authorization: `Bearer ${token}` } };

    await authenticate(request);

    expect(request.user).toMatchObject({ id: 5, role: ROLES.WORKER });
  });
});
