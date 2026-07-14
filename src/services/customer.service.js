import { REPOSITORY_KEYS } from '#constants/singleton';
import { NotFoundError } from '#configs/error';

export class CustomerService {
  constructor({ container }) {
    this.customerRepository = container.resolve(REPOSITORY_KEYS.CUSTOMER);
  }

  async register({ name }) {
    return this.customerRepository.create({ name });
  }

  async list() {
    return this.customerRepository.get({ order: [['id', 'ASC']] });
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
}
