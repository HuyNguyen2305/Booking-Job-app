export async function up({ context: queryInterface, DataTypes }) {
  await queryInterface.addColumn('workers', 'total_hours', {
    type: DataTypes.DOUBLE,
    allowNull: false,
    defaultValue: 0,
  });

  // Backfill from booking history that predates this column, so existing COMPLETED
  // work isn't silently dropped to 0 for workers who already had some.
  await queryInterface.sequelize.query(`
    UPDATE workers
    SET total_hours = sub.total
    FROM (
      SELECT worker_id, SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0) AS total
      FROM bookings
      WHERE status = 'COMPLETED'
      GROUP BY worker_id
    ) sub
    WHERE workers.id = sub.worker_id
  `);
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('workers', 'total_hours');
}
