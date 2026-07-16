import { SERVICE_KEYS } from '#constants/singleton';
import { ROLES } from '#constants/role.const';
import { assertOwnership } from '#src/common/auth/assert-ownership';

export class CustomerController {
  constructor({ container }) {
    this.customerService = container.resolve(SERVICE_KEYS.CUSTOMER);
  }

  async register(request, reply) {
    const customer = await this.customerService.register(request.body);
    return reply.code(201).send({ success: true, message: 'Customer registered', data: customer });
  }

  async list(request, reply) {
    const { page, limit } = request.query;
    const customers = await this.customerService.list({ page, limit });
    return reply.send({ success: true, message: 'Customers retrieved', data: customers });
  }

  async getById(request, reply) {
    const id = Number(request.params.id);
    assertOwnership(request.user, { role: ROLES.CUSTOMER, ownerId: id });
    const customer = await this.customerService.getById(id);
    return reply.send({ success: true, message: 'Customer retrieved', data: customer });
  }

  async updateName(request, reply) {
    const id = Number(request.params.id);
    assertOwnership(request.user, { role: ROLES.CUSTOMER, ownerId: id });
    const customer = await this.customerService.updateName(id, request.body.name);
    return reply.send({ success: true, message: 'Customer updated', data: customer });
  }

  async remove(request, reply) {
    const result = await this.customerService.remove(Number(request.params.id));
    return reply.send({ success: true, message: 'Customer deleted', data: result });
  }
}
