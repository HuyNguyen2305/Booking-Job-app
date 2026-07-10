import { CONTROLLER_KEYS } from '#constants/singleton';
import { createHolidaySchema, listHolidaysSchema, deleteHolidaySchema } from '#schemas/holiday.schema';

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
      handler: this.holidayController.create.bind(this.holidayController),
    });

    this.fastify.route({
      method: 'GET',
      url: '/api/holidays',
      schema: listHolidaysSchema,
      config: { responseFormat: 'standard' },
      handler: this.holidayController.list.bind(this.holidayController),
    });

    this.fastify.route({
      method: 'DELETE',
      url: '/api/holidays/:id',
      schema: deleteHolidaySchema,
      config: { responseFormat: 'standard' },
      handler: this.holidayController.remove.bind(this.holidayController),
    });
  }
}

export default async function holidayRouterPlugin(fastify) {
  new HolidayRouter(fastify).register();
}
