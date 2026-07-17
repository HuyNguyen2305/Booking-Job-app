import { REPOSITORY_KEYS, SERVICE_KEYS } from '#constants/singleton';
import { NotFoundError, ConflictError } from '#configs/error';
import { ACCOUNT_ERROR_CODES } from '#constants/error-codes.const';
import { isUniqueConstraintError } from '#utils/sequelize-error.util';
import { buildAccountSearchWhere } from '#utils/account-search.util';
import { hashPassword } from '#src/common/auth/password.util';

export class CustomerService {
  constructor({ container }) {
    this.customerRepository = container.resolve(REPOSITORY_KEYS.CUSTOMER);
    this.bookingService = container.resolve(SERVICE_KEYS.BOOKING);
  }

  async register({ name, email, password, address }) {
    const password_hash = await hashPassword(password);
    try {
      return await this.customerRepository.create({ name, email, password_hash, address });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictError('Email already registered', { code: ACCOUNT_ERROR_CODES.EMAIL_ALREADY_REGISTERED });
      }
      throw err;
    }
  }

  async list({ page, limit, name, email, is_active } = {}) {
    const where = buildAccountSearchWhere({ name, email, is_active });
    return this.customerRepository.pagination({ where, order: [['id', 'ASC']], page, limit });
  }

  async getById(id) {
    const customer = await this.customerRepository.getOne({ where: { id } });
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    return customer;
  }

  async updateProfile(id, { name, address } = {}) {
    const customer = await this.customerRepository.getOne({ where: { id } });
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    const updates = { name };
    if (address !== undefined) {
      updates.address = address;
    }
    return this.customerRepository.update({ id }, updates);
  }

  /**
   * Soft-deletes a customer (is_active: false) and cancels every one of their still-open
   * bookings via BookingService.cancelBookingsForCustomer — which itself leaves a
   * currently-in-progress CONFIRMED booking untouched rather than cancelling it out from
   * under the worker. No shared transaction with the bookings cancellation: a booking
   * being protected is an expected outcome here, not a failure that should block the
   * customer's own deletion.
   */
  async remove(id) {
    const customer = await this.customerRepository.getOne({ where: { id } });
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const cancellation = await this.bookingService.cancelBookingsForCustomer(id);
    const updated = await this.customerRepository.update({ id }, { is_active: false });

    return { ...updated.toJSON(), ...cancellation };
  }
}
