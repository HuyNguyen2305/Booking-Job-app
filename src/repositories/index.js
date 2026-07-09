import { REPOSITORY_KEYS } from '#constants/singleton';
import { BookingRepository } from '#repositories/booking.repository';

export function registerRepositories(container) {
  container.registerSingleton(REPOSITORY_KEYS.BOOKING, BookingRepository);
}
