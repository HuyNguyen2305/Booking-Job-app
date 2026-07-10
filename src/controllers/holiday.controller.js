import { SERVICE_KEYS } from '#constants/singleton';

export class HolidayController {
  constructor({ container }) {
    this.holidayService = container.resolve(SERVICE_KEYS.HOLIDAY);
  }

  async create(request, reply) {
    const holiday = await this.holidayService.create(request.body);
    return reply.code(201).send({ success: true, message: 'Holiday created', data: holiday });
  }

  async list(request, reply) {
    const holidays = await this.holidayService.list();
    return reply.send({ success: true, message: [], data: holidays });
  }

  async remove(request, reply) {
    const holiday = await this.holidayService.remove(request.params.id);
    return reply.send({ success: true, message: 'Holiday deleted', data: holiday });
  }
}
