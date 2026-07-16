export async function up({ context: queryInterface, DataTypes }) {
  await queryInterface.addColumn('customers', 'email', { type: DataTypes.STRING, allowNull: true });
  await queryInterface.addColumn('customers', 'password_hash', { type: DataTypes.STRING, allowNull: true });
  await queryInterface.addIndex('customers', ['email'], { unique: true, name: 'customers_email_unique' });
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeIndex('customers', 'customers_email_unique');
  await queryInterface.removeColumn('customers', 'password_hash');
  await queryInterface.removeColumn('customers', 'email');
}
