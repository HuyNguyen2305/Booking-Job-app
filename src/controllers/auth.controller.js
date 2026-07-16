import { SERVICE_KEYS } from '#constants/singleton';

export class AuthController {
  constructor({ container }) {
    this.authService = container.resolve(SERVICE_KEYS.AUTH);
  }

  async loginAdmin(request, reply) {
    const { email, password } = request.body;
    const result = await this.authService.loginAdmin(email, password);
    return reply.send({ success: true, message: 'Login successful', data: result });
  }

  async loginWorker(request, reply) {
    const { email, password } = request.body;
    const result = await this.authService.loginWorker(email, password);
    return reply.send({ success: true, message: 'Login successful', data: result });
  }

  async loginCustomer(request, reply) {
    const { email, password } = request.body;
    const result = await this.authService.loginCustomer(email, password);
    return reply.send({ success: true, message: 'Login successful', data: result });
  }
}
