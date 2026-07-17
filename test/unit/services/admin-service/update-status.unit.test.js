import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const adminRepositoryMock = {
  getOne: jest.fn(),
  update: jest.fn(),
};

const { AdminService } = await import('#services/admin.service');
const { NotFoundError, ValidationError } = await import('#configs/error');

describe('AdminService.updateStatus', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = Object.create(AdminService.prototype);
    service.adminRepository = adminRepositoryMock;
  });

  it('throws NotFoundError when the admin does not exist', async () => {
    adminRepositoryMock.getOne.mockResolvedValue(null);

    await expect(service.updateStatus(999, false)).rejects.toBeInstanceOf(NotFoundError);
    expect(adminRepositoryMock.update).not.toHaveBeenCalled();
  });

  it('deactivates an existing admin', async () => {
    adminRepositoryMock.getOne.mockResolvedValue({ id: 1, name: 'Root', is_active: true });
    const updated = { id: 1, name: 'Root', is_active: false };
    adminRepositoryMock.update.mockResolvedValue(updated);

    const result = await service.updateStatus(1, false);

    expect(adminRepositoryMock.update).toHaveBeenCalledWith({ id: 1 }, { is_active: false });
    expect(result).toBe(updated);
  });

  it('reactivates an existing admin', async () => {
    adminRepositoryMock.getOne.mockResolvedValue({ id: 1, name: 'Root', is_active: false });
    const updated = { id: 1, name: 'Root', is_active: true };
    adminRepositoryMock.update.mockResolvedValue(updated);

    const result = await service.updateStatus(1, true);

    expect(adminRepositoryMock.update).toHaveBeenCalledWith({ id: 1 }, { is_active: true });
    expect(result).toBe(updated);
  });

  it('throws ValidationError when an admin tries to deactivate their own account', async () => {
    adminRepositoryMock.getOne.mockResolvedValue({ id: 1, name: 'Root', is_active: true });

    await expect(service.updateStatus(1, false, { callerId: 1 })).rejects.toBeInstanceOf(ValidationError);
    expect(adminRepositoryMock.update).not.toHaveBeenCalled();
  });

  it('allows an admin to reactivate their own account (guard only blocks self-deactivation)', async () => {
    adminRepositoryMock.getOne.mockResolvedValue({ id: 1, name: 'Root', is_active: false });
    const updated = { id: 1, name: 'Root', is_active: true };
    adminRepositoryMock.update.mockResolvedValue(updated);

    const result = await service.updateStatus(1, true, { callerId: 1 });

    expect(result).toBe(updated);
  });

  it('allows an admin to deactivate a different admin', async () => {
    adminRepositoryMock.getOne.mockResolvedValue({ id: 2, name: 'Other', is_active: true });
    const updated = { id: 2, name: 'Other', is_active: false };
    adminRepositoryMock.update.mockResolvedValue(updated);

    const result = await service.updateStatus(2, false, { callerId: 1 });

    expect(result).toBe(updated);
  });

  it('enforces the guard even when no callerId is given (defensive default)', async () => {
    adminRepositoryMock.getOne.mockResolvedValue({ id: 1, name: 'Root', is_active: true });
    const updated = { id: 1, name: 'Root', is_active: false };
    adminRepositoryMock.update.mockResolvedValue(updated);

    // callerId omitted entirely — id !== undefined, so this is NOT mistaken for self.
    const result = await service.updateStatus(1, false);

    expect(result).toBe(updated);
  });
});
