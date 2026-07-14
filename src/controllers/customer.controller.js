import { SERVICE_KEYS } from '#constants/singleton';

export class CustomerController {
  constructor({ container }) {
    this.customerService = container.resolve(SERVICE_KEYS.CUSTOMER);
  }

  async register(request, reply) {
    const customer = await this.customerService.register(request.body);
    return reply.code(201).send({ success: true, message: 'Customer registered', data: customer });
  }

  async list(request, reply) {
    const customers = await this.customerService.list();
    return reply.send({ success: true, message: 'Customers retrieved', data: customers });
  }

  async getById(request, reply) {
    const customer = await this.customerService.getById(Number(request.params.id));
    return reply.send({ success: true, message: 'Customer retrieved', data: customer });
  }

  async updateName(request, reply) {
    const customer = await this.customerService.updateName(Number(request.params.id), request.body.name);
    return reply.send({ success: true, message: 'Customer updated', data: customer });
  }
}
