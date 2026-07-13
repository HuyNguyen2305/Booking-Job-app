import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const workerServiceMock = {
  listAvailable: jest.fn(),
  register: jest.fn(),
  list: jest.fn(),
  updateStatus: jest.fn(),
};

class MockWorkerService {
  constructor() {
    return workerServiceMock;
  }
}

jest.unstable_mockModule('#services/worker.service', () => ({ WorkerService: MockWorkerService }));

const { buildApp } = await import('#src/index');
const { NotFoundError } = await import('#configs/error');

describe('PATCH /api/workers/:id (router + controller + error handler)', () => {
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

  it('returns 200 with the updated worker on success', async () => {
    const worker = { id: 1, name: 'Alice', is_active: false };
    workerServiceMock.updateStatus.mockResolvedValue(worker);

    const response = await app.inject({ method: 'PATCH', url: '/api/workers/1', payload: { is_active: false } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Worker status updated', data: worker });
    expect(workerServiceMock.updateStatus).toHaveBeenCalledWith(1, false);
  });

  it('returns 404 in the custom error shape when the worker does not exist', async () => {
    workerServiceMock.updateStatus.mockRejectedValue(new NotFoundError('Worker not found'));

    const response = await app.inject({ method: 'PATCH', url: '/api/workers/999', payload: { is_active: false } });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ success: false, message: 'Worker not found' });
  });

  it('returns 400 schema validation error when is_active is missing, without calling the service', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/api/workers/1', payload: {} });

    expect(response.statusCode).toBe(400);
    expect(workerServiceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('returns 400 schema validation error when is_active is not a boolean, without calling the service', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/api/workers/1', payload: { is_active: 'nope' } });

    expect(response.statusCode).toBe(400);
    expect(workerServiceMock.updateStatus).not.toHaveBeenCalled();
  });
});
