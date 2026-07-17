import { REPOSITORY_KEYS } from '#constants/singleton';
import { hashPassword } from '#src/common/auth/password.util';
import { NotFoundError, ConflictError } from '#configs/error';
import { ACCOUNT_ERROR_CODES } from '#constants/error-codes.const';
import { isUniqueConstraintError } from '#utils/sequelize-error.util';
import { buildAccountSearchWhere } from '#utils/account-search.util';

export class AdminService {
  constructor({ container }) {
    this.adminRepository = container.resolve(REPOSITORY_KEYS.ADMIN);
  }

  async create({ name, email, password }) {
    const password_hash = await hashPassword(password);
    try {
      return await this.adminRepository.create({ name, email, password_hash });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictError('Email already registered', { code: ACCOUNT_ERROR_CODES.EMAIL_ALREADY_REGISTERED });
      }
      throw err;
    }
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

  async updateStatus(id, is_active) {
    const admin = await this.adminRepository.getOne({ where: { id } });
    if (!admin) {
      throw new NotFoundError('Admin not found');
    }
    return this.adminRepository.update({ id }, { is_active });
  }
}
