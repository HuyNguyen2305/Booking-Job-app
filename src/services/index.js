import { SERVICE_KEYS } from '#constants/singleton';
import { BookingService } from '#services/booking.service';
import { BookingAvailabilityService } from '#services/booking-availability.service';
import { WorkerService } from '#services/worker.service';
import { HolidayService } from '#services/holiday.service';
import { CustomerService } from '#services/customer.service';

export function registerServices(container) {
  container.registerSingleton(SERVICE_KEYS.BOOKING, BookingService);
  container.registerSingleton(SERVICE_KEYS.BOOKING_AVAILABILITY, BookingAvailabilityService);
  container.registerSingleton(SERVICE_KEYS.WORKER, WorkerService);
  container.registerSingleton(SERVICE_KEYS.HOLIDAY, HolidayService);
  container.registerSingleton(SERVICE_KEYS.CUSTOMER, CustomerService);
}
