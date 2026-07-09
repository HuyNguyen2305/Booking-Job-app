export async function up({ context: queryInterface, DataTypes }) {
  const now = queryInterface.sequelize.literal('NOW()');

  await queryInterface.createTable('bookings', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    worker_id: { type: DataTypes.INTEGER, allowNull: false },
    customer_id: { type: DataTypes.INTEGER, allowNull: false },
    start_time: { type: DataTypes.DATE, allowNull: false },
    end_time: { type: DataTypes.DATE, allowNull: false },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
  });

  await queryInterface.addConstraint('bookings', {
    fields: ['status'],
    type: 'check',
    name: 'bookings_status_check',
    where: {
      status: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
    },
  });

  await queryInterface.addIndex('bookings', ['worker_id']);
  await queryInterface.addIndex('bookings', ['worker_id', 'start_time', 'end_time']);
  await queryInterface.addIndex('bookings', ['status']);
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable('bookings');
}
