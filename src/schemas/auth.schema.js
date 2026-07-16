import { buildSuccessResponse } from '#common-schemas/response.schema';

const loginBodySchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 1 },
  },
};

function buildLoginSchema(role, profileKey) {
  return {
    tags: ['Auth'],
    summary: `Log in as ${role}`,
    body: loginBodySchema,
    response: {
      200: buildSuccessResponse({
        type: 'object',
        properties: {
          token: { type: 'string' },
          [profileKey]: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              email: { type: 'string' },
            },
          },
        },
      }),
    },
  };
}

export const loginAdminSchema = buildLoginSchema('an admin', 'admin');
export const loginWorkerSchema = buildLoginSchema('a worker', 'worker');
export const loginCustomerSchema = buildLoginSchema('a customer', 'customer');
