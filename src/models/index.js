import 'dotenv/config';
import { createSequelizeInstance } from '#configs/database';
import { Booking } from '#models/booking.model';
import { Worker } from '#models/worker.model';
import { Holiday } from '#models/holiday.model';
import { Customer } from '#models/customer.model';
import { Admin } from '#models/admin.model';

export const sequelize = createSequelizeInstance();

Booking.init(sequelize);
Worker.init(sequelize);
Holiday.init(sequelize);
Customer.init(sequelize);
Admin.init(sequelize);
