export async function up({ context: queryInterface, DataTypes }) {
  await queryInterface.addColumn('customers', 'is_active', {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('customers', 'is_active');
}
