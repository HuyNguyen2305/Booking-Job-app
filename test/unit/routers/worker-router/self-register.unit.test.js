import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const workerServiceMock = {
  listAvailable: jest.fn(),
  register: jest.fn(),
  selfRegister: jest.fn(),
  list: jest.fn(),
};

class MockWorkerService {
  constructor() {
    return workerServiceMock;
  }
}

jest.unstable_mockModule('#services/worker.service', () => ({ WorkerService: MockWorkerService }));

const { buildApp } = await import('#src/index');
const { ConflictError } = await import('#configs/error');
const { ACCOUNT_ERROR_CODES } = await import('#constants/error-codes.const');

describe('POST /api/workers/register (router + controller)', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 201 with the registered worker, inactive', async () => {
    const worker = { id: 1, name: 'Alice', email: 'alice@example.com', is_active: false };
    workerServiceMock.selfRegister.mockResolvedValue(worker);

    const payload = { name: 'Alice', email: 'alice@example.com', password: 'secret' };
    const response = await app.inject({ method: 'POST', url: '/api/workers/register', payload });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      success: true,
      message: 'Worker registered — pending admin approval',
      data: worker,
    });
    expect(workerServiceMock.selfRegister).toHaveBeenCalledWith(payload);
  });

  it('returns 400 schema validation error when name/email/password is missing', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/workers/register', payload: {} });

    expect(response.statusCode).toBe(400);
    expect(workerServiceMock.selfRegister).not.toHaveBeenCalled();
  });

  it('returns 400 schema validation error when name/email exceeds 255 chars', async () => {
    const tooLong = 'a'.repeat(256);
    const payload = { name: tooLong, email: `${tooLong}@example.com`, password: 'secret' };
    const response = await app.inject({ method: 'POST', url: '/api/workers/register', payload });

    expect(response.statusCode).toBe(400);
    expect(workerServiceMock.selfRegister).not.toHaveBeenCalled();
  });

  it('returns 409 with EMAIL_ALREADY_REGISTERED when the service reports a duplicate email', async () => {
    workerServiceMock.selfRegister.mockRejectedValue(
      new ConflictError('Email already registered', { code: ACCOUNT_ERROR_CODES.EMAIL_ALREADY_REGISTERED })
    );

    const payload = { name: 'Alice', email: 'alice@example.com', password: 'secret' };
    const response = await app.inject({ method: 'POST', url: '/api/workers/register', payload });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      success: false,
      message: 'Email already registered',
      code: ACCOUNT_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
    });
  });
});
