import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const workerServiceMock = {
  listAvailable: jest.fn(),
  register: jest.fn(),
  list: jest.fn(),
};

class MockWorkerService {
  constructor() {
    return workerServiceMock;
  }
}

jest.unstable_mockModule('#services/worker.service', () => ({ WorkerService: MockWorkerService }));

const { buildApp } = await import('#src/index');
const { ValidationError } = await import('#configs/error');
const { BOOKING_ERROR_CODES } = await import('#constants/error-codes.const');

describe('GET /api/workers/available (router + controller + error handler)', () => {
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

  it('returns 200 with the ranked available workers', async () => {
    const workers = [{ worker_id: 1, booked_hours_that_day: 2 }];
    workerServiceMock.listAvailable.mockResolvedValue(workers);

    const response = await app.inject({
      method: 'GET',
      url: '/api/workers/available?start=2026-07-14T09:00:00%2B07:00&end=2026-07-14T10:00:00%2B07:00',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, message: 'Available workers', data: workers });
  });

  it('returns 200 with a "No available worker" message when the result is empty', async () => {
    workerServiceMock.listAvailable.mockResolvedValue([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/workers/available?start=2026-07-14T09:00:00%2B07:00&end=2026-07-14T10:00:00%2B07:00',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      message: 'No available worker for this time window',
      data: [],
    });
  });

  it('returns 400 schema validation error when start/end are missing, without calling the service', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/workers/available' });

    expect(response.statusCode).toBe(400);
    expect(workerServiceMock.listAvailable).not.toHaveBeenCalled();
  });

  it('returns 400 with code INVALID_TIMESTAMP_FORMAT when the service rejects a missing-offset timestamp', async () => {
    workerServiceMock.listAvailable.mockRejectedValue(
      new ValidationError('start/end must be ISO 8601 date-times with an explicit UTC offset', {
        code: BOOKING_ERROR_CODES.INVALID_TIMESTAMP_FORMAT,
      })
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/workers/available?start=2026-07-14T09:00:00&end=2026-07-14T10:00:00%2B07:00',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: BOOKING_ERROR_CODES.INVALID_TIMESTAMP_FORMAT });
  });
});
