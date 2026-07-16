export async function up({ context: queryInterface, DataTypes }) {
  await queryInterface.addColumn('workers', 'email', { type: DataTypes.STRING, allowNull: true });
  await queryInterface.addColumn('workers', 'password_hash', { type: DataTypes.STRING, allowNull: true });
  await queryInterface.addIndex('workers', ['email'], { unique: true, name: 'workers_email_unique' });
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeIndex('workers', 'workers_email_unique');
  await queryInterface.removeColumn('workers', 'password_hash');
  await queryInterface.removeColumn('workers', 'email');
}
