import { CONTROLLER_KEYS } from '#constants/singleton';
import {
  registerCustomerSchema,
  listCustomersSchema,
  updateCustomerSchema,
  getCustomerSchema,
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
      method: 'GET',
      url: '/api/customers',
      schema: listCustomersSchema,
      config: { responseFormat: 'standard' },
      handler: this.customerController.list.bind(this.customerController),
    });

    this.fastify.route({
      method: 'PATCH',
      url: '/api/customers/:id',
      schema: updateCustomerSchema,
      config: { responseFormat: 'standard' },
      handler: this.customerController.updateName.bind(this.customerController),
    });

    this.fastify.route({
      method: 'GET',
      url: '/api/customers/:id',
      schema: getCustomerSchema,
      config: { responseFormat: 'standard' },
      handler: this.customerController.getById.bind(this.customerController),
    });
  }
}

export default async function customerRouterPlugin(fastify) {
  new CustomerRouter(fastify).register();
}
