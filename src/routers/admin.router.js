import { CONTROLLER_KEYS } from '#constants/singleton';
import { ROLES } from '#constants/role.const';
import { requireRole } from '#src/common/auth/require-role';
import { createAdminSchema, listAdminsSchema, getAdminSchema, updateAdminStatusSchema } from '#schemas/admin.schema';

class AdminRouter {
  constructor(fastify) {
    this.fastify = fastify;
    this.adminController = fastify.container.resolve(CONTROLLER_KEYS.ADMIN);
  }

  register() {
    this.fastify.route({
      method: 'POST',
      url: '/api/admins',
      schema: createAdminSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN)],
      handler: this.adminController.create.bind(this.adminController),
    });

    this.fastify.route({
      method: 'GET',
      url: '/api/admins',
      schema: listAdminsSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN)],
      handler: this.adminController.list.bind(this.adminController),
    });

    this.fastify.route({
      method: 'GET',
      url: '/api/admins/:id',
      schema: getAdminSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN)],
      handler: this.adminController.getById.bind(this.adminController),
    });

    this.fastify.route({
      method: 'PATCH',
      url: '/api/admins/:id',
      schema: updateAdminStatusSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN)],
      handler: this.adminController.updateStatus.bind(this.adminController),
    });
  }
}

export default async function adminRouterPlugin(fastify) {
  new AdminRouter(fastify).register();
}
