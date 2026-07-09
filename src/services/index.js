import { SERVICE_KEYS } from '#constants/singleton';
import { BookingService } from '#services/booking.service';

export function registerServices(container) {
  container.registerSingleton(SERVICE_KEYS.BOOKING, BookingService);
}
