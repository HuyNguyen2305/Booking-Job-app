import { buildSuccessResponse } from '#common-schemas/response.schema';
import { BOOKING_STATUS_VALUES } from '#constants/booking-status.const';

const bookingSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    worker_id: { type: 'integer' },
    customer_id: { type: 'integer' },
    start_time: { type: 'string', format: 'date-time' },
    end_time: { type: 'string', format: 'date-time' },
    status: { type: 'string', enum: BOOKING_STATUS_VALUES },
  },
};

const bookingWithAssignmentSchema = {
  type: 'object',
  properties: {
    ...bookingSchema.properties,
    reassigned: { type: 'boolean' },
    requested_worker_id: { type: 'integer' },
  },
};

export const createBookingSchema = {
  tags: ['Bookings'],
  summary: 'Create a booking',
  description:
    'Books a worker for a job in a specific time window. end_time must be at least 30 minutes after start_time, and the worker must not already have an overlapping PENDING/CONFIRMED booking.',
  body: {
    type: 'object',
    required: ['worker_id', 'customer_id', 'start_time', 'end_time'],
    properties: {
      worker_id: { type: 'integer', minimum: 1 },
      customer_id: { type: 'integer', minimum: 1 },
      start_time: { type: 'string', format: 'date-time' },
      end_time: { type: 'string', format: 'date-time' },
    },
  },
  response: {
    201: buildSuccessResponse(bookingWithAssignmentSchema),
  },
};

export const rescheduleBookingSchema = {
  tags: ['Bookings'],
  summary: 'Reschedule a booking',
  description:
    'Changes start_time/end_time on an existing PENDING or CONFIRMED booking. Re-runs the same weekday/business-hours/holiday/overlap checks as creation, with automatic fallback to another worker if the current one is no longer free.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer' },
    },
  },
  body: {
    type: 'object',
    required: ['start_time', 'end_time'],
    properties: {
      start_time: { type: 'string', format: 'date-time' },
      end_time: { type: 'string', format: 'date-time' },
    },
  },
  response: {
    200: buildSuccessResponse(bookingWithAssignmentSchema),
  },
};

export const reassignBookingSchema = {
  tags: ['Bookings'],
  summary: 'Move a booking to another available worker',
  description:
    'Moves an existing PENDING or CONFIRMED, not-yet-started booking off its current worker onto whichever other active worker is free for that same time slot — start_time/end_time are unchanged. Useful after a cancellation or new worker registration frees up capacity that was not available when a worker-deactivation attempt previously failed on this booking. The current worker is never offered back as its own replacement.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer' },
    },
  },
  response: {
    200: buildSuccessResponse(bookingWithAssignmentSchema),
  },
};

export const updateBookingStatusSchema = {
  tags: ['Bookings'],
  summary: 'Update a booking status',
  description:
    'Allowed transitions: PENDING -> CONFIRMED, CONFIRMED -> COMPLETED, PENDING -> CANCELLED, CONFIRMED -> CANCELLED.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer' },
    },
  },
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: BOOKING_STATUS_VALUES },
    },
  },
  response: {
    200: buildSuccessResponse(bookingSchema),
  },
};

export const listBookingsSchema = {
  tags: ['Bookings'],
  summary: "List a worker's or customer's bookings",
  description:
    'Returns bookings sorted by start_time ascending, filtered by either worker_id or customer_id (exactly one required). Optionally filter to bookings overlapping a [from, to] window.',
  querystring: {
    type: 'object',
    anyOf: [{ required: ['worker_id'] }, { required: ['customer_id'] }],
    properties: {
      worker_id: { type: 'integer', minimum: 1 },
      customer_id: { type: 'integer', minimum: 1 },
      from: { type: 'string', format: 'date-time' },
      to: { type: 'string', format: 'date-time' },
    },
  },
  response: {
    200: buildSuccessResponse({ type: 'array', items: bookingSchema }),
  },
};

export const getBookingSchema = {
  tags: ['Bookings'],
  summary: 'Get a booking by id',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer' },
    },
  },
  response: {
    200: buildSuccessResponse(bookingSchema),
  },
};

export const cancelBookingSchema = {
  tags: ['Bookings'],
  summary: 'Delete (cancel) a booking',
  description:
    'Soft-deletes a booking by transitioning it to CANCELLED — the row is kept for history, not removed. Only PENDING/CONFIRMED bookings can be cancelled; COMPLETED/CANCELLED are terminal. Equivalent to PATCH /api/bookings/:id/status with {status: "CANCELLED"}, exposed here as a DELETE for convenience.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer' },
    },
  },
  response: {
    200: buildSuccessResponse(bookingSchema),
  },
};
