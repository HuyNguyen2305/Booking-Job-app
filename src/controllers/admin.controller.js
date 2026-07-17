import { SERVICE_KEYS } from '#constants/singleton';

export class AdminController {
  constructor({ container }) {
    this.adminService = container.resolve(SERVICE_KEYS.ADMIN);
  }

  async create(request, reply) {
    const admin = await this.adminService.create(request.body);
    return reply.code(201).send({ success: true, message: 'Admin created', data: admin });
  }

  async list(request, reply) {
    const { page, limit, name, email, is_active } = request.query;
    const admins = await this.adminService.list({ page, limit, name, email, is_active });
    return reply.send({ success: true, message: 'Admins retrieved', data: admins });
  }

  async getById(request, reply) {
    const admin = await this.adminService.getById(Number(request.params.id));
    return reply.send({ success: true, message: 'Admin retrieved', data: admin });
  }

  async updateStatus(request, reply) {
    const id = Number(request.params.id);
    const { is_active } = request.body;
    const admin = await this.adminService.updateStatus(id, is_active, { callerId: request.user?.id });
    return reply.send({ success: true, message: 'Admin status updated', data: admin });
  }
}
