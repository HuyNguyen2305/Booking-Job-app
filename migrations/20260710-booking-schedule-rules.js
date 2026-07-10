// Pre-flight audit queries — run manually before applying this migration to any
// environment with real data (both ALTER TABLE statements below fail outright if
// existing rows violate them; they cannot use NOT VALID for an EXCLUDE constraint,
// and this migration validates the CHECK immediately too):
//
//   -- overlapping active bookings for the same worker:
//   SELECT b1.id, b2.id FROM bookings b1 JOIN bookings b2
//     ON b1.worker_id = b2.worker_id AND b1.id < b2.id
//     AND b1.status <> 'CANCELLED' AND b2.status <> 'CANCELLED'
//     AND tstzrange(b1.start_time, b1.end_time) && tstzrange(b2.start_time, b2.end_time);
//
//   -- rows outside 09:00-17:00 Asia/Ho_Chi_Minh or spanning two local calendar days:
//   SELECT id FROM bookings WHERE NOT (
//     (EXTRACT(HOUR FROM (start_time AT TIME ZONE 'Asia/Ho_Chi_Minh'))*60 + EXTRACT(MINUTE FROM (start_time AT TIME ZONE 'Asia/Ho_Chi_Minh'))) >= 540
//     AND (EXTRACT(HOUR FROM (end_time AT TIME ZONE 'Asia/Ho_Chi_Minh'))*60 + EXTRACT(MINUTE FROM (end_time AT TIME ZONE 'Asia/Ho_Chi_Minh'))) <= 1020
//     AND (start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (end_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
//   );

export async function up({ context: queryInterface, DataTypes }) {
  const sequelize = queryInterface.sequelize;
  const now = sequelize.literal('NOW()');

  await sequelize.query('CREATE EXTENSION IF NOT EXISTS btree_gist');

  await queryInterface.createTable('workers', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
  });

  // Real race-condition backstop: two concurrent transactions can both pass an
  // app-layer pre-check under READ COMMITTED; this is what actually serializes
  // them. Uses tstzrange (not tsrange) because start_time/end_time are timestamptz
  // — tsrange(timestamptz, timestamptz) does not exist in Postgres.
  await sequelize.query(`
    ALTER TABLE bookings
      ADD CONSTRAINT no_overlapping_bookings
      EXCLUDE USING gist (
        worker_id WITH =,
        tstzrange(start_time, end_time) WITH &&
      )
      WHERE (status <> 'CANCELLED')
  `);

  // Defense-in-depth mirror of the app-layer business-hours check. The IANA zone
  // is a literal baked in at migration-authoring time — Postgres CHECK constraints
  // cannot read process.env.BUSINESS_TZ at runtime. If BUSINESS_TZ ever changes,
  // this constraint silently drifts out of sync until a new migration updates it.
  await sequelize.query(`
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_business_hours_check
      CHECK (
        (EXTRACT(HOUR FROM (start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')) * 60
          + EXTRACT(MINUTE FROM (start_time AT TIME ZONE 'Asia/Ho_Chi_Minh'))) >= 9 * 60
        AND (EXTRACT(HOUR FROM (end_time AT TIME ZONE 'Asia/Ho_Chi_Minh')) * 60
          + EXTRACT(MINUTE FROM (end_time AT TIME ZONE 'Asia/Ho_Chi_Minh'))) <= 17 * 60
        AND (start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (end_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      ) NOT VALID
  `);
  await sequelize.query('ALTER TABLE bookings VALIDATE CONSTRAINT bookings_business_hours_check');

  await queryInterface.createTable('holidays', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: sequelize.literal('gen_random_uuid()') },
    holiday_date: { type: DataTypes.DATEONLY, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    recurring_annual: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
  });
  await queryInterface.addIndex('holidays', ['holiday_date']);
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable('holidays');
  await queryInterface.sequelize.query('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_business_hours_check');
  await queryInterface.sequelize.query('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_overlapping_bookings');
  await queryInterface.dropTable('workers');
  // btree_gist intentionally not dropped (cheap, may be relied on elsewhere).
}
