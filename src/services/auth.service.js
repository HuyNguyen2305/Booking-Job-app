import { REPOSITORY_KEYS } from '#constants/singleton';
import { ROLES } from '#constants/role.const';
import { verifyPassword } from '#src/common/auth/password.util';
import { signToken } from '#src/common/auth/jwt.util';
import { UnauthorizedError } from '#configs/error';

export class AuthService {
  constructor({ container }) {
    this.adminRepository = container.resolve(REPOSITORY_KEYS.ADMIN);
    this.workerRepository = container.resolve(REPOSITORY_KEYS.WORKER);
    this.customerRepository = container.resolve(REPOSITORY_KEYS.CUSTOMER);
  }

  async loginAdmin(email, password) {
    const admin = await this.adminRepository.getOne({ where: { email } });
    return this._login(admin, password, ROLES.ADMIN, 'admin');
  }

  async loginWorker(email, password) {
    const worker = await this.workerRepository.getOne({ where: { email } });
    return this._login(worker, password, ROLES.WORKER, 'worker');
  }

  async loginCustomer(email, password) {
    const customer = await this.customerRepository.getOne({ where: { email } });
    return this._login(customer, password, ROLES.CUSTOMER, 'customer');
  }

  async _login(account, password, role, profileKey) {
    if (!account || !account.is_active || !(await verifyPassword(password, account.password_hash))) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = signToken({ id: account.id, role });
    return { token, [profileKey]: { id: account.id, name: account.name, email: account.email } };
  }
}
