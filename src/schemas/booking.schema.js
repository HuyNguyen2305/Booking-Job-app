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
    201: buildSuccessResponse(bookingSchema),
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
  summary: "List a worker's schedule",
  description:
    'Returns a worker\'s bookings sorted by start_time ascending. Optionally filter to bookings overlapping a [from, to] window to see whether the worker is free or busy.',
  querystring: {
    type: 'object',
    required: ['worker_id'],
    properties: {
      worker_id: { type: 'integer', minimum: 1 },
      from: { type: 'string', format: 'date-time' },
      to: { type: 'string', format: 'date-time' },
    },
  },
  response: {
    200: buildSuccessResponse({ type: 'array', items: bookingSchema }),
  },
};
