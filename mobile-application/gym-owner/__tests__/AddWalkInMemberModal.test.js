import React from 'react';
import {
  DEFAULT_MEMBERSHIP_PLANS,
  PAYMENT_METHODS,
} from '../src/widgets/AddWalkInMemberModal';
import { apiService } from '../src/services/apiService';

// Mock dependencies
jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

jest.mock('../src/theme/ThemeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('../src/widgets/CustomScaffoldMessage', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    gym: { _id: 'gym-999', partnerId: 'GYM-001', name: 'Elite Fitness Center' },
    user: { gymId: 'gym-999' },
  }),
}));

describe('AddWalkInMemberModal Constants & Data Structures (SSOT)', () => {
  test('DEFAULT_MEMBERSHIP_PLANS contains monthly, quarterly, half_yearly, and annual tiers', () => {
    expect(Array.isArray(DEFAULT_MEMBERSHIP_PLANS)).toBe(true);
    const keys = DEFAULT_MEMBERSHIP_PLANS.map((p) => p.key);
    expect(keys).toContain('monthly');
    expect(keys).toContain('quarterly');
    expect(keys).toContain('half_yearly');
    expect(keys).toContain('annual');
  });

  test('each membership plan has valid durationDays, price > 0, and feature list', () => {
    DEFAULT_MEMBERSHIP_PLANS.forEach((plan) => {
      expect(typeof plan.name).toBe('string');
      expect(plan.durationDays).toBeGreaterThan(0);
      expect(plan.price).toBeGreaterThan(0);
      expect(Array.isArray(plan.features)).toBe(true);
      expect(plan.features.length).toBeGreaterThan(0);
    });
  });

  test('PAYMENT_METHODS supports Cash, UPI, and Card desk options', () => {
    expect(Array.isArray(PAYMENT_METHODS)).toBe(true);
    const keys = PAYMENT_METHODS.map((m) => m.key);
    expect(keys).toContain('Cash');
    expect(keys).toContain('UPI');
    expect(keys).toContain('Card');
  });
});

describe('apiService.createWalkInMembership', () => {
  let executeFetchSpy;

  beforeEach(() => {
    executeFetchSpy = jest.spyOn(apiService, 'executeFetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          membership: {
            _id: 'mem-123',
            memberId: 'MEM-999',
            fullName: 'Sanjay Kumar',
            planName: 'Gold (3 Months)',
            source: 'WALK_IN',
            status: 'Active',
            amountPaid: 4499,
          },
        },
      }),
    });
  });

  afterEach(() => {
    executeFetchSpy.mockRestore();
  });

  test('createWalkInMembership successfully sends payload with source: WALK_IN', async () => {
    const payload = {
      fullName: 'Sanjay Kumar',
      phoneNumber: '9876543210',
      email: 'sanjay@example.com',
      gender: 'Male',
      planName: 'Gold (3 Months)',
      planDuration: 'Quarterly',
      startDate: '2026-11-04',
      endDate: '2027-02-02',
      amountPaid: 4499,
      paymentMethod: 'Cash',
      source: 'WALK_IN',
      trainerAssigned: 'Karthik Raja',
    };

    const res = await apiService.createWalkInMembership('gym-999', payload);

    expect(executeFetchSpy).toHaveBeenCalledWith(
      '/memberships/gym/gym-999/walk-in',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
    expect(res.membership.source).toBe('WALK_IN');
    expect(res.membership.planName).toBe('Gold (3 Months)');
  });

  test('throws error when gymId is missing', async () => {
    await expect(apiService.createWalkInMembership('', {})).rejects.toThrow('Gym ID is required.');
  });
});
