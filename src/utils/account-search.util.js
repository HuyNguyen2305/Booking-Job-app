import { Op } from 'sequelize';

/**
 * Builds a Sequelize `where` for the roster-listing endpoints shared by Customer, Worker,
 * and Admin (the three "account" tables — same name/email/is_active shape). name/email are
 * case-insensitive substring matches; is_active is an exact match. Omitted filters are left
 * out of the where entirely, not compared against, so an absent param never narrows results.
 */
export function buildAccountSearchWhere({ name, email, is_active } = {}) {
  const where = {};
  if (name) where.name = { [Op.iLike]: `%${name}%` };
  if (email) where.email = { [Op.iLike]: `%${email}%` };
  if (is_active !== undefined) where.is_active = is_active;
  return where;
}
