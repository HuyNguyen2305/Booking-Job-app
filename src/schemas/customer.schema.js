import { buildSuccessResponse, buildPaginatedResponse } from '#common-schemas/response.schema';

const customerSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    email: { type: 'string' },
    is_active: { type: 'boolean' },
  },
};

export const registerCustomerSchema = {
  tags: ['Customers'],
  summary: 'Register a new customer (self-signup)',
  body: {
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
      name: { type: 'string', minLength: 1 },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 1 },
    },
  },
  response: {
    201: buildSuccessResponse(customerSchema),
  },
};

export const listCustomersSchema = {
  tags: ['Customers'],
  summary: 'List registered customers (paginated)',
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, default: 20 },
    },
  },
  response: {
    200: buildPaginatedResponse(customerSchema),
  },
};

export const getCustomerSchema = {
  tags: ['Customers'],
  summary: 'Get a customer by id',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer' },
    },
  },
  response: {
    200: buildSuccessResponse(customerSchema),
  },
};

export const deleteCustomerSchema = {
  tags: ['Customers'],
  summary: 'Delete (deactivate) a customer',
  description:
    'Soft-deletes a customer (is_active: false) and cancels every one of their still-open PENDING/CONFIRMED bookings. A CONFIRMED booking currently in progress (start_time already passed, not yet completed) is left untouched rather than cancelled out from under the worker. A deleted customer can no longer have new bookings created against them.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer' },
    },
  },
  response: {
    200: buildSuccessResponse({
      type: 'object',
      properties: {
        ...customerSchema.properties,
        cancelled_booking_ids: { type: 'array', items: { type: 'integer' } },
        skipped_booking_ids: {
          type: 'array',
          items: {
            type: 'object',
            properties: { booking_id: { type: 'integer' }, reason: { type: 'string' } },
          },
        },
      },
    }),
  },
};

export const updateCustomerSchema = {
  tags: ['Customers'],
  summary: "Update a customer's name",
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer' },
    },
  },
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1 },
    },
  },
  response: {
    200: buildSuccessResponse(customerSchema),
  },
};
