import { CONTROLLER_KEYS } from '#constants/singleton';
import { BookingController } from '#controllers/booking.controller';
import { WorkerController } from '#controllers/worker.controller';
import { HolidayController } from '#controllers/holiday.controller';
import { CustomerController } from '#controllers/customer.controller';
import { AdminController } from '#controllers/admin.controller';
import { AuthController } from '#controllers/auth.controller';

export function registerControllers(container) {
  container.registerSingleton(CONTROLLER_KEYS.BOOKING, BookingController);
  container.registerSingleton(CONTROLLER_KEYS.WORKER, WorkerController);
  container.registerSingleton(CONTROLLER_KEYS.HOLIDAY, HolidayController);
  container.registerSingleton(CONTROLLER_KEYS.CUSTOMER, CustomerController);
  container.registerSingleton(CONTROLLER_KEYS.ADMIN, AdminController);
  container.registerSingleton(CONTROLLER_KEYS.AUTH, AuthController);
}
