export async function up({ context: queryInterface, DataTypes }) {
  await queryInterface.addColumn('customers', 'address', { type: DataTypes.STRING, allowNull: true });
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('customers', 'address');
}
