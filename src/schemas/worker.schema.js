import { buildSuccessResponse, buildPaginatedResponse } from '#common-schemas/response.schema';
import { varcharField } from '#common-schemas/field.schema';

const workerSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    email: { type: 'string' },
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

const workerDetailSchema = {
  type: 'object',
  properties: {
    ...workerSchema.properties,
    hours_this_week: { type: 'number' },
    weekly_hours_cap: { type: 'number' },
    total_hours: { type: 'number' },
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
  description: 'Admin-only staff onboarding. The initial password is chosen by the admin and relayed to the worker out-of-band.',
  body: {
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
      name: varcharField({ nonEmpty: true }),
      email: varcharField({ format: 'email' }),
      password: { type: 'string', minLength: 1 },
    },
  },
  response: {
    201: buildSuccessResponse(workerSchema),
  },
};

export const selfRegisterWorkerSchema = {
  tags: ['Workers'],
  summary: 'Register a new worker (self-signup)',
  description:
    'Public self-signup. The worker is created inactive (is_active: false) until an admin approves them via PATCH /api/workers/:id.',
  body: {
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
      name: varcharField({ nonEmpty: true }),
      email: varcharField({ format: 'email' }),
      password: { type: 'string', minLength: 1 },
    },
  },
  response: {
    201: buildSuccessResponse(workerSchema),
  },
};

export const listWorkersSchema = {
  tags: ['Workers'],
  summary: 'List registered workers (paginated, optionally filtered)',
  description:
    'name/email match as case-insensitive substrings; is_active matches exactly. Any combination of filters may be supplied together.',
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      name: varcharField(),
      email: varcharField(),
      is_active: { type: 'boolean' },
    },
  },
  response: {
    200: buildPaginatedResponse(workerSchema),
  },
};

export const getWorkerSchema = {
  tags: ['Workers'],
  summary: 'Get a worker by id, including a performance snapshot',
  description:
    'hours_this_week/weekly_hours_cap reflect only COMPLETED bookings within the current business-local week (Monday-Sunday); total_hours is the all-time COMPLETED total.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer' },
    },
  },
  response: {
    200: buildSuccessResponse(workerDetailSchema),
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
