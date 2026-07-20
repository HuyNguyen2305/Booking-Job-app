import { SERVICE_KEYS } from '#constants/singleton';
import { ROLES } from '#constants/role.const';
import { BOOKING_STATUS } from '#constants/booking-status.const';
import { isAuthEnforced } from '#src/common/auth/env';
import { assertOwnership, assertOwnershipAny } from '#src/common/auth/assert-ownership';
import { ValidationError } from '#configs/error';

// Who may drive a booking to each target status via PATCH .../status: a Worker may only
// confirm their own assigned job; only a Customer (or Admin, who bypasses this map
// entirely) may mark it COMPLETED or CANCELLED — a Worker cannot unilaterally complete
// or cancel a booking that belongs to someone else's account. PENDING is deliberately
// absent — BOOKING_STATUS_TRANSITIONS never allows any status to transition TO PENDING,
// so it's always an invalid target; the ownership gate below skips it and lets
// BookingService.updateStatus's transition-table check reject it with an accurate 409,
// rather than this map guessing an owner role for a target no role is ever allowed to reach.
const STATUS_OWNER_ROLE = {
  [BOOKING_STATUS.CONFIRMED]: ROLES.WORKER,
  [BOOKING_STATUS.COMPLETED]: ROLES.CUSTOMER,
  [BOOKING_STATUS.CANCELLED]: ROLES.CUSTOMER,
};

// How a Worker/Customer's own-scoped list() request is resolved: which query param names
// their own id (for the optional mismatch check) and which service method actually lists
// their bookings. ADMIN isn't here — it has no implicit "own id", so it's handled
// separately in list() below.
const LIST_SCOPE_BY_ROLE = {
  [ROLES.WORKER]: { param: 'worker_id', list: (service, id, opts) => service.listByWorker(id, opts) },
  [ROLES.CUSTOMER]: { param: 'customer_id', list: (service, id, opts) => service.listByCustomer(id, opts) },
};

export class BookingController {
  constructor({ container }) {
    this.bookingService = container.resolve(SERVICE_KEYS.BOOKING);
    this.bookingAvailabilityService = container.resolve(SERVICE_KEYS.BOOKING_AVAILABILITY);
  }

  async create(request, reply) {
    const body =
      request.user?.role === ROLES.CUSTOMER ? { ...request.body, customer_id: request.user.id } : request.body;
    const booking = await this.bookingService.createBooking(body);
    return reply.code(201).send({ success: true, message: 'Booking created', data: booking });
  }

  async updateStatus(request, reply) {
    const id = Number(request.params.id);
    const targetStatus = request.body.status;
    // Ownership needs the existing row's worker_id/customer_id, which the mutating call
    // itself doesn't return — only fetched when enforcement is actually on, since it's an
    // extra DB round-trip that's pure overhead during the dev/test bypass.
    if (isAuthEnforced()) {
      const requiredRole = STATUS_OWNER_ROLE[targetStatus];
      const existing = await this.bookingService.getById(id);
      if (requiredRole) {
        const ownerId = requiredRole === ROLES.WORKER ? existing.worker_id : existing.customer_id;
        assertOwnership(request.user, { role: requiredRole, ownerId });
      } else {
        // No role owns this target status (only PENDING — no transition ever reaches it,
        // so BOOKING_STATUS_TRANSITIONS will always reject it with 409). Still require
        // SOME ownership relationship to the booking (worker or customer) rather than
        // skipping the check outright — otherwise any authenticated Worker/Customer could
        // probe arbitrary booking ids for existence/status via this endpoint's 404/409.
        assertOwnershipAny(request.user, [
          { role: ROLES.WORKER, ownerId: existing.worker_id },
          { role: ROLES.CUSTOMER, ownerId: existing.customer_id },
        ]);
      }
    }
    const booking = await this.bookingService.updateStatus(id, targetStatus);
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
    const role = request.user?.role;
    const scope = LIST_SCOPE_BY_ROLE[role];

    // Which id is actually queried is driven by the CALLER's role, never by "whichever
    // query param happens to be present" — a Customer supplying a stray worker_id must
    // never leak that worker's schedule for every customer. A Worker/Customer's own id
    // (from their token) is what gets queried; the other role's id param is ignored.
    // Both params are optional for these two roles: if their own-role param is present it
    // must match their token (guards against a confused/malicious explicit mismatch), but
    // its absence is not itself suspicious — it's the normal "just show me my bookings" call.
    if (scope) {
      const ownParam = request.query[scope.param];
      if (ownParam !== undefined) {
        assertOwnership(request.user, { role, ownerId: ownParam });
      }
      const bookings = await scope.list(this.bookingService, request.user.id, { from, to, page, limit });
      return reply.send({ success: true, message: 'Bookings retrieved', data: bookings });
    }

    // ADMIN (including the synthetic bypass identity): honor whichever query param was given.
    // Unlike Worker/Customer, Admin has no implicit "own id" to fall back to, so exactly
    // one of worker_id/customer_id is required here (the schema only rejects supplying
    // both — it can't require "at least one" without also blocking Worker/Customer's
    // legitimate no-params request, so that half of the rule lives here instead).
    if (!worker_id && !customer_id) {
      throw new ValidationError('worker_id or customer_id is required');
    }
    const bookings = worker_id
      ? await this.bookingService.listByWorker(worker_id, { from, to, page, limit })
      : await this.bookingService.listByCustomer(customer_id, { from, to, page, limit });
    return reply.send({ success: true, message: 'Bookings retrieved', data: bookings });
  }

  async listAvailableSlots(request, reply) {
    const { date, days, duration_minutes } = request.query;
    const slots = await this.bookingAvailabilityService.listAvailableSlots(date, { days, duration_minutes });
    return reply.send({ success: true, message: 'Available slots retrieved', data: slots });
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
