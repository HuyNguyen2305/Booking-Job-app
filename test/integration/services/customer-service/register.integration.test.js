import { describe, it, expect, afterEach } from '@jest/globals';

const { CustomerRepository } = await import('#repositories/customer.repository');
const { CustomerService } = await import('#services/customer.service');
const { Customer } = await import('#models/customer.model');
const { ConflictError } = await import('#configs/error');
const { ACCOUNT_ERROR_CODES } = await import('#constants/error-codes.const');

/**
 * Real committed rows, not seedWithTransaction — the point of this test is a genuine
 * Postgres unique-constraint violation on a second insert, which needs the first row to
 * have actually committed first.
 */
describe('CustomerService.register (integration)', () => {
  let customerIds = [];

  afterEach(async () => {
    if (customerIds.length) {
      await Customer.destroy({ where: { id: customerIds } });
      customerIds = [];
    }
  });

  function buildService() {
    const customerService = Object.create(CustomerService.prototype);
    customerService.customerRepository = new CustomerRepository();
    return customerService;
  }

  it('registering the same email twice throws ConflictError with EMAIL_ALREADY_REGISTERED instead of a raw DB error', async () => {
    const customerService = buildService();
    const email = `duplicate-${Date.now()}@example.com`;

    const first = await customerService.register({ name: 'First', email, password: 'secret', address: '1 Main St' });
    customerIds.push(first.id);

    await expect(
      customerService.register({ name: 'Second', email, password: 'secret', address: '2 Other St' })
    ).rejects.toMatchObject({
      code: ACCOUNT_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
    });
    await expect(
      customerService.register({ name: 'Second', email, password: 'secret', address: '2 Other St' })
    ).rejects.toBeInstanceOf(ConflictError);

    // Confirm no stray second row was left behind by the failed attempt.
    const matching = await Customer.findAll({ where: { email } });
    expect(matching).toHaveLength(1);
  });
});
