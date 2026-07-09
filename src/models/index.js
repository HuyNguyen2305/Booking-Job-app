import 'dotenv/config';
import { createSequelizeInstance } from '#configs/database';
import { Booking } from '#models/booking.model';

export const sequelize = createSequelizeInstance();

Booking.init(sequelize);

export const models = { Booking };
