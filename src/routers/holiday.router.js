import { CONTROLLER_KEYS } from '#constants/singleton';
import { ROLES } from '#constants/role.const';
import { requireRole } from '#src/common/auth/require-role';
import {
  createHolidaySchema,
  createHolidayRangeSchema,
  listHolidaysSchema,
  deleteHolidaySchema,
} from '#schemas/holiday.schema';

class HolidayRouter {
  constructor(fastify) {
    this.fastify = fastify;
    this.holidayController = fastify.container.resolve(CONTROLLER_KEYS.HOLIDAY);
  }

  register() {
    this.fastify.route({
      method: 'POST',
      url: '/api/holidays',
      schema: createHolidaySchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN)],
      handler: this.holidayController.create.bind(this.holidayController),
    });

    this.fastify.route({
      method: 'POST',
      url: '/api/holidays/range',
      schema: createHolidayRangeSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN)],
      handler: this.holidayController.createRange.bind(this.holidayController),
    });

    this.fastify.route({
      method: 'GET',
      url: '/api/holidays',
      schema: listHolidaysSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN, ROLES.WORKER, ROLES.CUSTOMER)],
      handler: this.holidayController.list.bind(this.holidayController),
    });

    this.fastify.route({
      method: 'DELETE',
      url: '/api/holidays/:id',
      schema: deleteHolidaySchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN)],
      handler: this.holidayController.remove.bind(this.holidayController),
    });
  }
}

export default async function holidayRouterPlugin(fastify) {
  new HolidayRouter(fastify).register();
}
