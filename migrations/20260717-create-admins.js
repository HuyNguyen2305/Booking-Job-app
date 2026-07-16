export async function up({ context: queryInterface, DataTypes }) {
  const sequelize = queryInterface.sequelize;
  const now = sequelize.literal('NOW()');

  await queryInterface.createTable('admins', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: now },
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable('admins');
}
