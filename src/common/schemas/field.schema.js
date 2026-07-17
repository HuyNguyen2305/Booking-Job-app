// Every string column in this codebase's models is a plain Sequelize STRING, i.e.
// Postgres VARCHAR(255) — see src/models/*.model.js. Centralizing that cap here means a
// new schema field can't silently omit it the way `customers.address` originally did,
// letting an oversized value reach Postgres as a raw, unhandled DB error instead of a
// clean 400.
const VARCHAR_MAX_LENGTH = 255;

/**
 * A VARCHAR(255)-backed string field. `nonEmpty: true` also requires at least 1 character
 * (for required "must actually contain something" body fields like name/address); `format`
 * adds an AJV string format (e.g. 'email'). Omit both for an optional filter/search field.
 */
export function varcharField({ nonEmpty = false, format } = {}) {
  return {
    type: 'string',
    maxLength: VARCHAR_MAX_LENGTH,
    ...(nonEmpty ? { minLength: 1 } : {}),
    ...(format ? { format } : {}),
  };
}
