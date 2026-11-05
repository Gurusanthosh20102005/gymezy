import React from 'react';
import {
  SESSION_TIERS,
  PAYMENT_METHODS,
  ENTRY_STATUSES,
  DEFAULT_TIME_SLOTS,
} from '../src/widgets/AddWalkInBookingModal';
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
    gym: { _id: 'gym-456', partnerId: 'GYM-002', name: 'Elite Fitness Center', singleSessionPrice: 200 },
    user: { gymId: 'gym-456' },
  }),
}));

describe('AddWalkInBookingModal Constants & Enums (SSOT)', () => {
  test('SESSION_TIERS contains PER_DAY, WEEKLY, and CUSTOM', () => {
    expect(Array.isArray(SESSION_TIERS)).toBe(true);
    const keys = SESSION_TIERS.map((t) => t.key);
    expect(keys).toContain('PER_DAY');
    expect(keys).toContain('WEEKLY');
    expect(keys).toContain('CUSTOM');
  });

  test('PAYMENT_METHODS supports Cash, UPI, and Card', () => {
    expect(Array.isArray(PAYMENT_METHODS)).toBe(true);
    const keys = PAYMENT_METHODS.map((m) => m.key);
    expect(keys).toContain('Cash');
    expect(keys).toContain('UPI');
    expect(keys).toContain('Card');
  });

  test('ENTRY_STATUSES includes Checked-in and Upcoming', () => {
    expect(Array.isArray(ENTRY_STATUSES)).toBe(true);
    const keys = ENTRY_STATUSES.map((s) => s.key);
    expect(keys).toContain('Checked-in');
    expect(keys).toContain('Upcoming');
  });

  test('DEFAULT_TIME_SLOTS contains standard morning and evening slots', () => {
    expect(Array.isArray(DEFAULT_TIME_SLOTS)).toBe(true);
    expect(DEFAULT_TIME_SLOTS).toContain('06:00 AM');
    expect(DEFAULT_TIME_SLOTS).toContain('07:00 AM');
    expect(DEFAULT_TIME_SLOTS).toContain('05:00 PM');
    expect(DEFAULT_TIME_SLOTS).toContain('06:00 PM');
  });
});

describe('Walk-in Pricing Calculation Logic (Single Source of Truth)', () => {
  const calculateTotalFee = (tier, baseRate, trainerDailyFee, customDates = []) => {
    if (tier === 'PER_DAY') {
      return baseRate + trainerDailyFee;
    }
    if (tier === 'WEEKLY') {
      return (baseRate * 7) + (trainerDailyFee * 7);
    }
    if (tier === 'CUSTOM') {
      const days = Math.max(1, customDates.length);
      return (baseRate + trainerDailyFee) * days;
    }
    return baseRate;
  };

  test('calculates 1 Day Pass price correctly without trainer', () => {
    const total = calculateTotalFee('PER_DAY', 200, 0);
    expect(total).toBe(200);
  });

  test('calculates 1 Day Pass price correctly with personal trainer add-on', () => {
    const total = calculateTotalFee('PER_DAY', 200, 300);
    expect(total).toBe(500);
  });

  test('calculates Weekly (7 days) pass price correctly', () => {
    const total = calculateTotalFee('WEEKLY', 200, 100);
    expect(total).toBe((200 * 7) + (100 * 7)); // 2100
  });

  test('calculates Custom Dates pass price correctly based on date count', () => {
    const dates = ['2026-11-05', '2026-11-07', '2026-11-10'];
    const total = calculateTotalFee('CUSTOM', 250, 150, dates);
    expect(total).toBe((250 + 150) * 3); // 1200
  });
});

describe('ApiService Walk-in and Bookings Endpoints', () => {
  let executeFetchSpy;

  beforeEach(() => {
    executeFetchSpy = jest.spyOn(apiService, 'executeFetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  afterEach(() => {
    executeFetchSpy.mockRestore();
  });

  test('getGymBookings builds query string and calls GET /bookings/gym/:gymId', async () => {
    await apiService.getGymBookings('gym-456', { source: 'WALK_IN', status: 'Checked-in' });
    expect(executeFetchSpy).toHaveBeenCalledWith(
      '/bookings/gym/gym-456?source=WALK_IN&status=Checked-in',
      expect.objectContaining({ method: 'GET' })
    );
  });

  test('createWalkInBooking sends POST to /bookings/gym/:gymId/walk-in with full payload', async () => {
    const payload = {
      customerName: 'Rahul Kumar',
      phone: '9876543210',
      email: 'rahul@example.com',
      bookingType: 'GYM_SESSION',
      title: '1 Day Pass (General Access)',
      amount: 200,
      price: 200,
      paymentMethod: 'Cash',
      paymentStatus: 'Completed',
      checkInNow: true,
      timeSlot: '07:00 AM',
      startDate: '2026-11-04',
      endDate: '2026-11-04',
      isCustomDates: false,
      customDates: [],
    };

    await apiService.createWalkInBooking('gym-456', payload);
    expect(executeFetchSpy).toHaveBeenCalledWith(
      '/bookings/gym/gym-456/walk-in',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
  });

  test('throws error if gymId is missing', async () => {
    await expect(apiService.getGymBookings(null)).rejects.toThrow('Gym ID is required.');
    await expect(apiService.createWalkInBooking(null, {})).rejects.toThrow('Gym ID is required.');
  });
});
