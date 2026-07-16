import { BaseRepository } from '#src/common/base/base.repository';
import { Admin } from '#models/admin.model';

export class AdminRepository extends BaseRepository {
  constructor() {
    super(Admin);
  }
}
