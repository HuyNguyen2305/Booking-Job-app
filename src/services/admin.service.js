import { REPOSITORY_KEYS } from '#constants/singleton';
import { hashPassword } from '#src/common/auth/password.util';

export class AdminService {
  constructor({ container }) {
    this.adminRepository = container.resolve(REPOSITORY_KEYS.ADMIN);
  }

  async getByEmail(email) {
    return this.adminRepository.getOne({ where: { email } });
  }

  async create({ name, email, password }) {
    const password_hash = await hashPassword(password);
    return this.adminRepository.create({ name, email, password_hash });
  }
}
