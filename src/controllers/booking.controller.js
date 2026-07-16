import { SERVICE_KEYS } from '#constants/singleton';
import { ROLES } from '#constants/role.const';
import { isAuthEnforced } from '#src/common/auth/env';
import { assertOwnership, assertOwnershipAny } from '#src/common/auth/assert-ownership';

export class BookingController {
  constructor({ container }) {
    this.bookingService = container.resolve(SERVICE_KEYS.BOOKING);
  }

  async create(request, reply) {
    const body = request.user?.role === ROLES.CUSTOMER ? { ...request.body, customer_id: request.user.id } : request.body;
    const booking = await this.bookingService.createBooking(body);
    return reply.code(201).send({ success: true, message: 'Booking created', data: booking });
  }

  async updateStatus(request, reply) {
    const id = Number(request.params.id);
    // Ownership needs the existing row's worker_id, which the mutating call itself
    // doesn't return — only fetched when enforcement is actually on, since it's an
    // extra DB round-trip that's pure overhead during the dev/test bypass.
    if (isAuthEnforced()) {
      const existing = await this.bookingService.getById(id);
      assertOwnership(request.user, { role: ROLES.WORKER, ownerId: existing.worker_id });
    }
    const booking = await this.bookingService.updateStatus(id, request.body.status);
    return reply.send({ success: true, message: 'Booking status updated', data: booking });
  }

  async reschedule(request, reply) {
    const id = Number(request.params.id);
    if (isAuthEnforced()) {
      const existing = await this.bookingService.getById(id);
      assertOwnership(request.user, { role: ROLES.CUSTOMER, ownerId: existing.customer_id });
    }
    const booking = await this.bookingService.rescheduleBooking(id, request.body);
    return reply.send({ success: true, message: 'Booking rescheduled', data: booking });
  }

  async reassign(request, reply) {
    const booking = await this.bookingService.reassignBooking(Number(request.params.id));
    return reply.send({ success: true, message: 'Booking reassigned', data: booking });
  }

  async list(request, reply) {
    const { worker_id, customer_id, from, to, page, limit } = request.query;
    if (request.user?.role === ROLES.WORKER) {
      assertOwnership(request.user, { role: ROLES.WORKER, ownerId: worker_id });
    } else if (request.user?.role === ROLES.CUSTOMER) {
      assertOwnership(request.user, { role: ROLES.CUSTOMER, ownerId: customer_id });
    }
    const bookings = worker_id
      ? await this.bookingService.listByWorker(worker_id, { from, to, page, limit })
      : await this.bookingService.listByCustomer(customer_id, { from, to, page, limit });
    return reply.send({ success: true, message: 'Bookings retrieved', data: bookings });
  }

  async getById(request, reply) {
    const booking = await this.bookingService.getById(Number(request.params.id));
    assertOwnershipAny(request.user, [
      { role: ROLES.WORKER, ownerId: booking.worker_id },
      { role: ROLES.CUSTOMER, ownerId: booking.customer_id },
    ]);
    return reply.send({ success: true, message: 'Booking retrieved', data: booking });
  }

  async cancel(request, reply) {
    const id = Number(request.params.id);
    if (isAuthEnforced()) {
      const existing = await this.bookingService.getById(id);
      assertOwnership(request.user, { role: ROLES.CUSTOMER, ownerId: existing.customer_id });
    }
    const booking = await this.bookingService.cancelBooking(id);
    return reply.send({ success: true, message: 'Booking cancelled', data: booking });
  }

  async autoComplete(request, reply) {
    const result = await this.bookingService.autoCompletePastBookings();
    return reply.send({ success: true, message: `Auto-completed ${result.completed.length} booking(s)`, data: result });
  }
}
