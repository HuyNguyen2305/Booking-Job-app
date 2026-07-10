import { CONTROLLER_KEYS } from '#constants/singleton';
import { listAvailableWorkersSchema, registerWorkerSchema, listWorkersSchema } from '#schemas/worker.schema';

class WorkerRouter {
  constructor(fastify) {
    this.fastify = fastify;
    this.workerController = fastify.container.resolve(CONTROLLER_KEYS.WORKER);
  }

  register() {
    this.fastify.route({
      method: 'GET',
      url: '/api/workers/available',
      schema: listAvailableWorkersSchema,
      config: { responseFormat: 'standard' },
      handler: this.workerController.listAvailable.bind(this.workerController),
    });

    this.fastify.route({
      method: 'POST',
      url: '/api/workers',
      schema: registerWorkerSchema,
      config: { responseFormat: 'standard' },
      handler: this.workerController.register.bind(this.workerController),
    });

    this.fastify.route({
      method: 'GET',
      url: '/api/workers',
      schema: listWorkersSchema,
      config: { responseFormat: 'standard' },
      handler: this.workerController.list.bind(this.workerController),
    });
  }
}

export default async function workerRouterPlugin(fastify) {
  new WorkerRouter(fastify).register();
}
