import { DataTypes, Model } from 'sequelize';

export class Worker extends Model {
  static init(sequelize) {
    return super.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
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
