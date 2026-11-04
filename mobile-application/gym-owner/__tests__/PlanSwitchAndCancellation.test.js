import { apiService } from '../src/services/apiService';

describe('Plan Switch & Cancellation API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('respondToSwitchRequest sends correct action and mapped remarks', async () => {
    const mockExecute = jest.spyOn(apiService, 'executeFetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, data: { status: 'PENDING_SUPER_ADMIN_APPROVAL' } }),
    });

    const res = await apiService.respondToSwitchRequest('REQ123', {
      action: 'ACCEPT',
      remarks: 'Accepted by Gym Owner',
    });

    expect(mockExecute).toHaveBeenCalledWith(
      '/memberships/switch-requests/REQ123/gym-action',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          action: 'ACCEPT',
          remarks: 'Accepted by Gym Owner',
        }),
      })
    );
    expect(res.status).toBe('PENDING_SUPER_ADMIN_APPROVAL');

    mockExecute.mockRestore();
  });

  test('respondToSwitchRequest supports rejectionReason field', async () => {
    const mockExecute = jest.spyOn(apiService, 'executeFetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, data: { status: 'REJECTED_BY_GYM' } }),
    });

    await apiService.respondToSwitchRequest('REQ123', {
      action: 'REJECT',
      rejectionReason: 'Plan slots full',
    });

    expect(mockExecute).toHaveBeenCalledWith(
      '/memberships/switch-requests/REQ123/gym-action',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          action: 'REJECT',
          remarks: 'Plan slots full',
        }),
      })
    );

    mockExecute.mockRestore();
  });

  test('quoteCancellationRefund calculates deduction amount properly', async () => {
    const mockExecute = jest.spyOn(apiService, 'executeFetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, data: { status: 'PENDING_MEMBER_APPROVAL' } }),
    });

    // max 2000, refund 1500 -> deduction 500
    await apiService.quoteCancellationRefund('CAN-001', 2000, 1500, 'Special offer');

    expect(mockExecute).toHaveBeenCalledWith(
      '/memberships/cancellation-negotiations/CAN-001/gym-offer',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          deductionAmount: 500,
          message: 'Special offer',
        }),
      })
    );

    mockExecute.mockRestore();
  });

  test('rejectCancellation calls the gym-reject patch endpoint', async () => {
    const mockExecute = jest.spyOn(apiService, 'executeFetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, data: { status: 'REJECTED_BY_GYM' } }),
    });

    const res = await apiService.rejectCancellation('CAN-001');

    expect(mockExecute).toHaveBeenCalledWith(
      '/memberships/cancellation-negotiations/CAN-001/gym-reject',
      expect.objectContaining({
        method: 'PATCH',
      })
    );
    expect(res.status).toBe('REJECTED_BY_GYM');

    mockExecute.mockRestore();
  });

  test('requestCancellation initiates a negotiation with reason', async () => {
    const mockExecute = jest.spyOn(apiService, 'executeFetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, data: { status: 'PENDING_GYM_APPROVAL' } }),
    });

    const res = await apiService.requestCancellation('MEM-999', 'Member relocated');

    expect(mockExecute).toHaveBeenCalledWith(
      '/memberships/MEM-999/cancellation-negotiation',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          reason: 'Member relocated',
        }),
      })
    );
    expect(res.status).toBe('PENDING_GYM_APPROVAL');

    mockExecute.mockRestore();
  });
});

