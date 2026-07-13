import { SERVICE_KEYS } from '#constants/singleton';

export class WorkerController {
  constructor({ container }) {
    this.workerService = container.resolve(SERVICE_KEYS.WORKER);
  }

  async listAvailable(request, reply) {
    const { start, end } = request.query;
    const workers = await this.workerService.listAvailable({ start, end });
    return reply.send({ success: true, message: 'Available workers', data: workers });
  }

  async register(request, reply) {
    const worker = await this.workerService.register(request.body);
    return reply.code(201).send({ success: true, message: 'Worker registered', data: worker });
  }

  async list(request, reply) {
    const workers = await this.workerService.list();
    return reply.send({ success: true, message: [], data: workers });
  }

  async updateStatus(request, reply) {
    const worker = await this.workerService.updateStatus(Number(request.params.id), request.body.is_active);
    return reply.send({ success: true, message: 'Worker status updated', data: worker });
  }
}
