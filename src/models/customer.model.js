import { DataTypes, Model } from 'sequelize';

export class Customer extends Model {
  static init(sequelize) {
    return super.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false },
      },
      {
        sequelize,
        modelName: 'Customer',
        tableName: 'customers',
        underscored: true,
        timestamps: true,
      }
    );
  }
}
