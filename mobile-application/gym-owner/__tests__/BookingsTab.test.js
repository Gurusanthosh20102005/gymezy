import React from 'react';
import {
  SOURCE_FILTERS,
  STATUS_FILTERS,
  TYPE_FILTERS,
} from '../src/pages/tabs/BookingsTab';
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

describe('BookingsTab Filters & Enums (SSOT)', () => {
  test('SOURCE_FILTERS contains ALL, APP, and WALK_IN', () => {
    expect(Array.isArray(SOURCE_FILTERS)).toBe(true);
    const keys = SOURCE_FILTERS.map((s) => s.key);
    expect(keys).toEqual(['ALL', 'APP', 'WALK_IN']);
  });

  test('STATUS_FILTERS includes standard booking statuses', () => {
    expect(Array.isArray(STATUS_FILTERS)).toBe(true);
    expect(STATUS_FILTERS).toContain('All');
    expect(STATUS_FILTERS).toContain('Upcoming');
    expect(STATUS_FILTERS).toContain('Checked-in');
    expect(STATUS_FILTERS).toContain('Completed');
    expect(STATUS_FILTERS).toContain('Cancelled');
  });

  test('TYPE_FILTERS includes pass and session types', () => {
    expect(Array.isArray(TYPE_FILTERS)).toBe(true);
    expect(TYPE_FILTERS).toContain('All');
    expect(TYPE_FILTERS).toContain('Gym Session');
    expect(TYPE_FILTERS).toContain('Group Class');
    expect(TYPE_FILTERS).toContain('Walk-in Pass');
  });
});

describe('apiService Bookings & Passes Integration', () => {
  let executeFetchSpy;

  beforeEach(() => {
    executeFetchSpy = jest.spyOn(apiService, 'executeFetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          bookings: [
            {
              _id: 'b-1',
              bookingId: 'BK-101',
              userName: 'Rahul Verma',
              source: 'WALK_IN',
              status: 'Checked-in',
              price: 200,
            },
            {
              _id: 'b-2',
              bookingId: 'BK-102',
              userName: 'Priya Sharma',
              source: 'APP',
              status: 'Upcoming',
              price: 350,
            },
          ],
        },
      }),
    });
  });

  afterEach(() => {
    executeFetchSpy.mockRestore();
  });

  test('getGymBookings queries the endpoint with gymId and params', async () => {
    const res = await apiService.getGymBookings('gym-999', { limit: 50 });

    expect(executeFetchSpy).toHaveBeenCalledWith(
      '/bookings/gym/gym-999?limit=50',
      expect.objectContaining({ method: 'GET' })
    );
    expect(Array.isArray(res.bookings)).toBe(true);
    expect(res.bookings.length).toBe(2);
    expect(res.bookings[0].source).toBe('WALK_IN');
    expect(res.bookings[1].source).toBe('APP');
  });

  test('createWalkInBooking calls walk-in endpoint', async () => {
    const payload = {
      customerName: 'Anand Kumar',
      phone: '9876543210',
      price: 200,
      source: 'WALK_IN',
    };
    await apiService.createWalkInBooking('gym-999', payload);

    expect(executeFetchSpy).toHaveBeenCalledWith(
      '/bookings/gym/gym-999/walk-in',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) })
    );
  });
});
