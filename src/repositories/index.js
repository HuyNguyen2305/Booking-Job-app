import { REPOSITORY_KEYS } from '#constants/singleton';
import { BookingRepository } from '#repositories/booking.repository';
import { WorkerRepository } from '#repositories/worker.repository';
import { HolidayRepository } from '#repositories/holiday.repository';
import { CustomerRepository } from '#repositories/customer.repository';
import { AdminRepository } from '#repositories/admin.repository';

export function registerRepositories(container) {
  container.registerSingleton(REPOSITORY_KEYS.BOOKING, BookingRepository);
  container.registerSingleton(REPOSITORY_KEYS.WORKER, WorkerRepository);
  container.registerSingleton(REPOSITORY_KEYS.HOLIDAY, HolidayRepository);
  container.registerSingleton(REPOSITORY_KEYS.CUSTOMER, CustomerRepository);
  container.registerSingleton(REPOSITORY_KEYS.ADMIN, AdminRepository);
}
