import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const customerRepositoryMock = {
  getOne: jest.fn(),
  update: jest.fn(),
};
const bookingServiceMock = {
  cancelBookingsForCustomer: jest.fn(),
};

const { CustomerService } = await import('#services/customer.service');
const { NotFoundError } = await import('#configs/error');

describe('CustomerService.remove', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(CustomerService.prototype);
    service.customerRepository = customerRepositoryMock;
    service.bookingService = bookingServiceMock;
  });

  it('throws NotFoundError when the customer does not exist', async () => {
    customerRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.remove(999)).rejects.toBeInstanceOf(NotFoundError);
    expect(bookingServiceMock.cancelBookingsForCustomer).not.toHaveBeenCalled();
    expect(customerRepositoryMock.update).not.toHaveBeenCalled();
  });

  it("cancels the customer's bookings, deactivates the customer, and merges both results", async () => {
    customerRepositoryMock.getOne.mockResolvedValue({ id: 1, name: 'Alice', is_active: true });
    bookingServiceMock.cancelBookingsForCustomer.mockResolvedValue({
      cancelled_booking_ids: [10, 11],
      skipped_booking_ids: [{ booking_id: 12, reason: 'Cannot cancel a booking whose time has already passed' }],
    });
    const deactivated = { toJSON: () => ({ id: 1, name: 'Alice', is_active: false }) };
    customerRepositoryMock.update.mockResolvedValue(deactivated);

    const result = await service.remove(1);

    expect(bookingServiceMock.cancelBookingsForCustomer).toHaveBeenCalledWith(1);
    expect(customerRepositoryMock.update).toHaveBeenCalledWith({ id: 1 }, { is_active: false });
    expect(result).toEqual({
      id: 1,
      name: 'Alice',
      is_active: false,
      cancelled_booking_ids: [10, 11],
      skipped_booking_ids: [{ booking_id: 12, reason: 'Cannot cancel a booking whose time has already passed' }],
    });
  });
});
