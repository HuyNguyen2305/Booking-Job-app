import { buildSuccessResponse } from '#common-schemas/response.schema';

const workerSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    is_active: { type: 'boolean' },
  },
};

const reassignedBookingSchema = {
  type: 'object',
  properties: {
    booking_id: { type: 'integer' },
    new_worker_id: { type: 'integer' },
  },
};

const workerWithReassignmentsSchema = {
  type: 'object',
  properties: {
    ...workerSchema.properties,
    reassigned_bookings: { type: 'array', items: reassignedBookingSchema },
  },
};

const availableWorkerSchema = {
  type: 'object',
  properties: {
    worker_id: { type: 'integer' },
    booked_hours_that_day: { type: 'number' },
  },
};

export const listAvailableWorkersSchema = {
  tags: ['Workers'],
  summary: "List workers free in a time window",
  description:
    'Returns active workers with no overlapping booking in [start, end), sorted ascending by total booked hours that business-local calendar day.',
  querystring: {
    type: 'object',
    required: ['start', 'end'],
    properties: {
      start: { type: 'string', format: 'date-time' },
      end: { type: 'string', format: 'date-time' },
    },
  },
  response: {
    200: buildSuccessResponse({ type: 'array', items: availableWorkerSchema }),
  },
};

export const registerWorkerSchema = {
  tags: ['Workers'],
  summary: 'Register a new worker',
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1 },
    },
  },
  response: {
    201: buildSuccessResponse(workerSchema),
  },
};

export const listWorkersSchema = {
  tags: ['Workers'],
  summary: 'List all registered workers',
  response: {
    200: buildSuccessResponse({ type: 'array', items: workerSchema }),
  },
};

export const updateWorkerStatusSchema = {
  tags: ['Workers'],
  summary: 'Activate or deactivate a worker',
  description:
    'Deactivating a worker first reassigns every still-open (PENDING/CONFIRMED), not-yet-started booking of theirs to another available active worker; if even one such booking has no available replacement, the whole request fails and the worker stays active. COMPLETED/CANCELLED bookings, and any PENDING/CONFIRMED booking whose time has already passed, are left untouched.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer' },
    },
  },
  body: {
    type: 'object',
    required: ['is_active'],
    properties: {
      is_active: { type: 'boolean' },
    },
  },
  response: {
    200: buildSuccessResponse(workerWithReassignmentsSchema),
  },
};
