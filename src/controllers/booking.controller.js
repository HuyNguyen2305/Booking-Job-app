import { SERVICE_KEYS } from '#constants/singleton';

export class BookingController {
  constructor({ container }) {
    this.bookingService = container.resolve(SERVICE_KEYS.BOOKING);
  }

  async create(request, reply) {
    const booking = await this.bookingService.createBooking(request.body);
    return reply.code(201).send({ success: true, message: 'Booking created', data: booking });
  }

  async updateStatus(request, reply) {
    const booking = await this.bookingService.updateStatus(Number(request.params.id), request.body.status);
    return reply.send({ success: true, message: 'Booking status updated', data: booking });
  }

  async reschedule(request, reply) {
    const booking = await this.bookingService.rescheduleBooking(Number(request.params.id), request.body);
    return reply.send({ success: true, message: 'Booking rescheduled', data: booking });
  }

  async reassign(request, reply) {
    const booking = await this.bookingService.reassignBooking(Number(request.params.id));
    return reply.send({ success: true, message: 'Booking reassigned', data: booking });
  }

  async list(request, reply) {
    const { worker_id, customer_id, from, to } = request.query;
    const bookings = worker_id
      ? await this.bookingService.listByWorker(worker_id, { from, to })
      : await this.bookingService.listByCustomer(customer_id, { from, to });
    return reply.send({ success: true, message: 'Bookings retrieved', data: bookings });
  }

  async getById(request, reply) {
    const booking = await this.bookingService.getById(Number(request.params.id));
    return reply.send({ success: true, message: 'Booking retrieved', data: booking });
  }

  async cancel(request, reply) {
    const booking = await this.bookingService.cancelBooking(Number(request.params.id));
    return reply.send({ success: true, message: 'Booking cancelled', data: booking });
  }
}
