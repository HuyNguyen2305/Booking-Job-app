import { DataTypes, Model } from 'sequelize';

export class Customer extends Model {
  static init(sequelize) {
    return super.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false },
        email: { type: DataTypes.STRING, allowNull: true, unique: true },
        password_hash: { type: DataTypes.STRING, allowNull: true },
        address: { type: DataTypes.STRING, allowNull: true },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
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
