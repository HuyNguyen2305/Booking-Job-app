import 'dotenv/config';
import { createSequelizeInstance } from '#configs/database';
import { Booking } from '#models/booking.model';
import { Worker } from '#models/worker.model';
import { Holiday } from '#models/holiday.model';
import { Customer } from '#models/customer.model';

export const sequelize = createSequelizeInstance();

Booking.init(sequelize);
Worker.init(sequelize);
Holiday.init(sequelize);
Customer.init(sequelize);

export const models = { Booking, Worker, Holiday, Customer };
