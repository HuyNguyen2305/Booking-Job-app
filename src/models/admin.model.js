import { DataTypes, Model } from 'sequelize';

export class Admin extends Model {
  static init(sequelize) {
    return super.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false },
        email: { type: DataTypes.STRING, allowNull: false, unique: true },
        password_hash: { type: DataTypes.STRING, allowNull: false },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      },
      {
        sequelize,
        modelName: 'Admin',
        tableName: 'admins',
        underscored: true,
        timestamps: true,
      }
    );
  }
}
