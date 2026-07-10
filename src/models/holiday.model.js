import { DataTypes, Model } from 'sequelize';

export class Holiday extends Model {
  static init(sequelize) {
    return super.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        holiday_date: { type: DataTypes.DATEONLY, allowNull: false },
        name: { type: DataTypes.STRING, allowNull: false },
        recurring_annual: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      },
      {
        sequelize,
        modelName: 'Holiday',
        tableName: 'holidays',
        underscored: true,
        timestamps: true,
      }
    );
  }
}
