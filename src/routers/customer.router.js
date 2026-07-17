import { CONTROLLER_KEYS } from '#constants/singleton';
import { ROLES } from '#constants/role.const';
import { requireRole } from '#src/common/auth/require-role';
import {
  registerCustomerSchema,
  createCustomerSchema,
  listCustomersSchema,
  updateCustomerSchema,
  getCustomerSchema,
  deleteCustomerSchema,
} from '#schemas/customer.schema';

class CustomerRouter {
  constructor(fastify) {
    this.fastify = fastify;
    this.customerController = fastify.container.resolve(CONTROLLER_KEYS.CUSTOMER);
  }

  register() {
    this.fastify.route({
      method: 'POST',
      url: '/api/customers',
      schema: registerCustomerSchema,
      config: { responseFormat: 'standard' },
      handler: this.customerController.register.bind(this.customerController),
    });

    this.fastify.route({
      method: 'POST',
      url: '/api/customers/create',
      schema: createCustomerSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN)],
      handler: this.customerController.register.bind(this.customerController),
    });

    this.fastify.route({
      method: 'GET',
      url: '/api/customers',
      schema: listCustomersSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN)],
      handler: this.customerController.list.bind(this.customerController),
    });

    this.fastify.route({
      method: 'PATCH',
      url: '/api/customers/:id',
      schema: updateCustomerSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN, ROLES.CUSTOMER)],
      handler: this.customerController.updateProfile.bind(this.customerController),
    });

    this.fastify.route({
      method: 'GET',
      url: '/api/customers/:id',
      schema: getCustomerSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN, ROLES.CUSTOMER)],
      handler: this.customerController.getById.bind(this.customerController),
    });

    this.fastify.route({
      method: 'DELETE',
      url: '/api/customers/:id',
      schema: deleteCustomerSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN)],
      handler: this.customerController.remove.bind(this.customerController),
    });
  }
}

export default async function customerRouterPlugin(fastify) {
  new CustomerRouter(fastify).register();
}
