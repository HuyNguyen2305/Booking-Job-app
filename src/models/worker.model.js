import { DataTypes, Model } from 'sequelize';

export class Worker extends Model {
  static init(sequelize) {
    return super.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false },
        email: { type: DataTypes.STRING, allowNull: true, unique: true },
        password_hash: { type: DataTypes.STRING, allowNull: true },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        total_hours: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
      },
      {
        sequelize,
        modelName: 'Worker',
        tableName: 'workers',
        underscored: true,
        timestamps: true,
      }
    );
  }
}
