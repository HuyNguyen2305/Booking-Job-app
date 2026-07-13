import { CONTROLLER_KEYS } from '#constants/singleton';
import {
  createBookingSchema,
  updateBookingStatusSchema,
  rescheduleBookingSchema,
  reassignBookingSchema,
  listBookingsSchema,
} from '#schemas/booking.schema';

class BookingRouter {
  constructor(fastify) {
    this.fastify = fastify;
    this.bookingController = fastify.container.resolve(CONTROLLER_KEYS.BOOKING);
  }

  register() {
    this.fastify.route({
      method: 'POST',
      url: '/api/bookings',
      schema: createBookingSchema,
      config: { responseFormat: 'standard' },
      handler: this.bookingController.create.bind(this.bookingController),
    });

    this.fastify.route({
      method: 'PATCH',
      url: '/api/bookings/:id/status',
      schema: updateBookingStatusSchema,
      config: { responseFormat: 'standard' },
      handler: this.bookingController.updateStatus.bind(this.bookingController),
    });

    this.fastify.route({
      method: 'PATCH',
      url: '/api/bookings/:id',
      schema: rescheduleBookingSchema,
      config: { responseFormat: 'standard' },
      handler: this.bookingController.reschedule.bind(this.bookingController),
    });

    this.fastify.route({
      method: 'PATCH',
      url: '/api/bookings/:id/reassign',
      schema: reassignBookingSchema,
      config: { responseFormat: 'standard' },
      handler: this.bookingController.reassign.bind(this.bookingController),
    });

    this.fastify.route({
      method: 'GET',
      url: '/api/bookings',
      schema: listBookingsSchema,
      config: { responseFormat: 'standard' },
      handler: this.bookingController.list.bind(this.bookingController),
    });
  }
}

export default async function bookingRouterPlugin(fastify) {
  new BookingRouter(fastify).register();
}
