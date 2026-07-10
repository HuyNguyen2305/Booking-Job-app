import 'dotenv/config';
import { createSequelizeInstance } from '#configs/database';
import { Booking } from '#models/booking.model';
import { Worker } from '#models/worker.model';
import { Holiday } from '#models/holiday.model';

export const sequelize = createSequelizeInstance();

Booking.init(sequelize);
Worker.init(sequelize);
Holiday.init(sequelize);

export const models = { Booking, Worker, Holiday };
