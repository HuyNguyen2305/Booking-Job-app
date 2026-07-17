import { CONTROLLER_KEYS } from '#constants/singleton';
import { ROLES } from '#constants/role.const';
import { requireRole } from '#src/common/auth/require-role';
import {
  createBookingSchema,
  updateBookingStatusSchema,
  rescheduleBookingSchema,
  reassignBookingSchema,
  listBookingsSchema,
  getBookingSchema,
  cancelBookingSchema,
  autoCompleteBookingsSchema,
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
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN, ROLES.CUSTOMER)],
      handler: this.bookingController.create.bind(this.bookingController),
    });

    this.fastify.route({
      method: 'PATCH',
      url: '/api/bookings/:id/status',
      schema: updateBookingStatusSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN, ROLES.WORKER, ROLES.CUSTOMER)],
      handler: this.bookingController.updateStatus.bind(this.bookingController),
    });

    this.fastify.route({
      method: 'PATCH',
      url: '/api/bookings/:id',
      schema: rescheduleBookingSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN, ROLES.CUSTOMER)],
      handler: this.bookingController.reschedule.bind(this.bookingController),
    });

    this.fastify.route({
      method: 'PATCH',
      url: '/api/bookings/:id/reassign',
      schema: reassignBookingSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN)],
      handler: this.bookingController.reassign.bind(this.bookingController),
    });

    this.fastify.route({
      method: 'GET',
      url: '/api/bookings',
      schema: listBookingsSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN, ROLES.WORKER, ROLES.CUSTOMER)],
      handler: this.bookingController.list.bind(this.bookingController),
    });

    this.fastify.route({
      method: 'GET',
      url: '/api/bookings/:id',
      schema: getBookingSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN, ROLES.WORKER, ROLES.CUSTOMER)],
      handler: this.bookingController.getById.bind(this.bookingController),
    });

    this.fastify.route({
      method: 'DELETE',
      url: '/api/bookings/:id',
      schema: cancelBookingSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN, ROLES.CUSTOMER)],
      handler: this.bookingController.cancel.bind(this.bookingController),
    });

    this.fastify.route({
      method: 'POST',
      url: '/api/bookings/auto-complete',
      schema: autoCompleteBookingsSchema,
      config: { responseFormat: 'standard' },
      preValidation: [this.fastify.authenticate, requireRole(ROLES.ADMIN)],
      handler: this.bookingController.autoComplete.bind(this.bookingController),
    });
  }
}

export default async function bookingRouterPlugin(fastify) {
  new BookingRouter(fastify).register();
}
