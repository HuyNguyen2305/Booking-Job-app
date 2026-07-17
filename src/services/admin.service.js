import { REPOSITORY_KEYS } from '#constants/singleton';
import { hashPassword } from '#src/common/auth/password.util';
import { NotFoundError, ValidationError } from '#configs/error';
import { buildAccountSearchWhere } from '#utils/account-search.util';
import { createAccountOrThrowConflict } from '#utils/account-create.util';

export class AdminService {
  constructor({ container }) {
    this.adminRepository = container.resolve(REPOSITORY_KEYS.ADMIN);
  }

  async create({ name, email, password }) {
    const password_hash = await hashPassword(password);
    return createAccountOrThrowConflict(this.adminRepository, { name, email, password_hash });
  }

  async list({ page, limit, name, email, is_active } = {}) {
    const where = buildAccountSearchWhere({ name, email, is_active });
    return this.adminRepository.pagination({ where, order: [['id', 'ASC']], page, limit });
  }

  async getById(id) {
    const admin = await this.adminRepository.getOne({ where: { id } });
    if (!admin) {
      throw new NotFoundError('Admin not found');
    }
    return admin;
  }

  // An admin may not deactivate their own account — guards against losing all HTTP access
  // with no CLI/DB path back in. Enforced here (not just in the controller) so any other
  // caller of this method — a future script, CLI tool, or additional controller — can't
  // bypass the invariant by skipping the controller's own check.
  async updateStatus(id, is_active, { callerId } = {}) {
    const admin = await this.adminRepository.getOne({ where: { id } });
    if (!admin) {
      throw new NotFoundError('Admin not found');
    }
    if (!is_active && id === callerId) {
      throw new ValidationError('Cannot deactivate your own admin account');
    }
    return this.adminRepository.update({ id }, { is_active });
  }
}
