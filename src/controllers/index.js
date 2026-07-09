import { CONTROLLER_KEYS } from '#constants/singleton';
import { BookingController } from '#controllers/booking.controller';

export function registerControllers(container) {
  container.registerSingleton(CONTROLLER_KEYS.BOOKING, BookingController);
}
