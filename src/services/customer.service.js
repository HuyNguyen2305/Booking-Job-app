import { REPOSITORY_KEYS, SERVICE_KEYS } from '#constants/singleton';
import { NotFoundError } from '#configs/error';
import { hashPassword } from '#src/common/auth/password.util';

export class CustomerService {
  constructor({ container }) {
    this.customerRepository = container.resolve(REPOSITORY_KEYS.CUSTOMER);
    this.bookingService = container.resolve(SERVICE_KEYS.BOOKING);
  }

  async register({ name, email, password }) {
    const password_hash = await hashPassword(password);
    return this.customerRepository.create({ name, email, password_hash });
  }

  async list({ page, limit } = {}) {
    return this.customerRepository.pagination({ order: [['id', 'ASC']], page, limit });
  }

  async getById(id) {
    const customer = await this.customerRepository.getOne({ where: { id } });
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    return customer;
  }

  async updateName(id, name) {
    const customer = await this.customerRepository.getOne({ where: { id } });
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    return this.customerRepository.update({ id }, { name });
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
