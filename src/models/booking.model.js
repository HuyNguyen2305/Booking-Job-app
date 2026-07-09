import { DataTypes, Model } from 'sequelize';
import { BOOKING_STATUS, BOOKING_STATUS_VALUES } from '#constants/booking-status.const';

export class Booking extends Model {
  static init(sequelize) {
    return super.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        worker_id: { type: DataTypes.INTEGER, allowNull: false },
        customer_id: { type: DataTypes.INTEGER, allowNull: false },
        start_time: { type: DataTypes.DATE, allowNull: false },
        end_time: { type: DataTypes.DATE, allowNull: false },
        status: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: BOOKING_STATUS.PENDING,
          validate: { isIn: [BOOKING_STATUS_VALUES] },
        },
      },
      {
        sequelize,
        modelName: 'Booking',
        tableName: 'bookings',
        underscored: true,
        timestamps: true,
      }
    );
  }
}
