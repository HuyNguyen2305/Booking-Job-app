export class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async get({ where = {}, order, limit, offset, transaction } = {}) {
    return this.model.findAll({ where, order, limit, offset, transaction });
  }

  async getOne({ where = {}, transaction } = {}) {
    return this.model.findOne({ where, transaction });
  }

  async create(data, { transaction } = {}) {
    return this.model.create(data, { transaction });
  }

  async bulkCreate(rows, { transaction } = {}) {
    return this.model.bulkCreate(rows, { transaction });
  }

  async update(where, data, { transaction } = {}) {
    const [affected] = await this.model.update(data, { where, transaction });
    if (affected === 0) return null;
    return this.getOne({ where, transaction });
  }

  async delete(where, { transaction } = {}) {
    return this.model.destroy({ where, transaction });
  }

  async softDelete(where, { transaction } = {}) {
    return this.model.destroy({ where, transaction });
  }

  async pagination({ where = {}, page = 1, limit = 20, order = [], transaction } = {}) {
    const offset = (page - 1) * limit;
    const { rows, count } = await this.model.findAndCountAll({ where, limit, offset, order, transaction });
    return { rows, count, page, limit, totalPages: Math.ceil(count / limit) };
  }
}
