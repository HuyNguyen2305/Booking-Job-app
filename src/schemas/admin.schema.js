import { buildSuccessResponse, buildPaginatedResponse } from '#common-schemas/response.schema';
import { varcharField } from '#common-schemas/field.schema';

const adminSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    email: { type: 'string' },
    is_active: { type: 'boolean' },
  },
};

export const createAdminSchema = {
  tags: ['Admins'],
  summary: 'Create a new admin',
  description: 'Admin-only account management. The initial password is chosen by the creating admin and relayed out-of-band.',
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
    201: buildSuccessResponse(adminSchema),
  },
};

export const listAdminsSchema = {
  tags: ['Admins'],
  summary: 'List admin accounts (paginated, optionally filtered)',
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
    200: buildPaginatedResponse(adminSchema),
  },
};

export const getAdminSchema = {
  tags: ['Admins'],
  summary: 'Get an admin by id',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer' },
    },
  },
  response: {
    200: buildSuccessResponse(adminSchema),
  },
};

export const updateAdminStatusSchema = {
  tags: ['Admins'],
  summary: 'Activate or deactivate an admin',
  description: 'An admin may not deactivate their own account (guards against losing all HTTP access with no CLI/DB path back in).',
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
    200: buildSuccessResponse(adminSchema),
  },
};
