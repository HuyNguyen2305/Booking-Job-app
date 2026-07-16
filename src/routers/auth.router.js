import { CONTROLLER_KEYS } from '#constants/singleton';
import { loginAdminSchema, loginWorkerSchema, loginCustomerSchema } from '#schemas/auth.schema';

class AuthRouter {
  constructor(fastify) {
    this.fastify = fastify;
    this.authController = fastify.container.resolve(CONTROLLER_KEYS.AUTH);
  }

  register() {
    this.fastify.route({
      method: 'POST',
      url: '/api/auth/admin/login',
      schema: loginAdminSchema,
      config: { responseFormat: 'standard' },
      handler: this.authController.loginAdmin.bind(this.authController),
    });

    this.fastify.route({
      method: 'POST',
      url: '/api/auth/worker/login',
      schema: loginWorkerSchema,
      config: { responseFormat: 'standard' },
      handler: this.authController.loginWorker.bind(this.authController),
    });

    this.fastify.route({
      method: 'POST',
      url: '/api/auth/customer/login',
      schema: loginCustomerSchema,
      config: { responseFormat: 'standard' },
      handler: this.authController.loginCustomer.bind(this.authController),
    });
  }
}

export default async function authRouterPlugin(fastify) {
  new AuthRouter(fastify).register();
}
