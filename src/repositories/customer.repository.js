import { BaseRepository } from '#src/common/base/base.repository';
import { Customer } from '#models/customer.model';

export class CustomerRepository extends BaseRepository {
  constructor() {
    super(Customer);
  }
}
