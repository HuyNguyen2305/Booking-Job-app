// buildAccountSearchWhere (#utils/account-search.util) searches name/email with a
// leading-wildcard ILIKE ('%term%'), which no plain btree index (including the existing
// unique index on email) can serve — every roster search would otherwise force a
// sequential scan. A GIN trigram index is the standard Postgres fix for arbitrary
// substring search; pg_trgm is enabled once here (idempotent) since it isn't guaranteed
// to already exist on this shared database.
const SEARCHABLE_ACCOUNT_TABLES = ['customers', 'workers', 'admins'];
const SEARCHABLE_COLUMNS = ['name', 'email'];

function indexName(table, column) {
  return `${table}_${column}_trgm_idx`;
}

export async function up({ context: queryInterface }) {
  await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

  for (const table of SEARCHABLE_ACCOUNT_TABLES) {
    for (const column of SEARCHABLE_COLUMNS) {
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${indexName(table, column)} ON "${table}" USING gin ("${column}" gin_trgm_ops)`
      );
    }
  }
}

export async function down({ context: queryInterface }) {
  for (const table of SEARCHABLE_ACCOUNT_TABLES) {
    for (const column of SEARCHABLE_COLUMNS) {
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${indexName(table, column)}`);
    }
  }
  // Deliberately not dropping the pg_trgm extension itself — this is a shared database
  // (fronts a legacy PHP app's data too), and other code may come to depend on it once
  // enabled; CREATE EXTENSION IF NOT EXISTS already makes re-running up() safe regardless.
}
