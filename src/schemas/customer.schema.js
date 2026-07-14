import { buildSuccessResponse } from '#common-schemas/response.schema';

const customerSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
  },
};

export const registerCustomerSchema = {
  tags: ['Customers'],
  summary: 'Register a new customer',
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1 },
    },
  },
  response: {
    201: buildSuccessResponse(customerSchema),
  },
};

export const listCustomersSchema = {
  tags: ['Customers'],
  summary: 'List all registered customers',
  response: {
    200: buildSuccessResponse({ type: 'array', items: customerSchema }),
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
