import React from 'react';
import {
  AddTempStaffModal,
  TEMP_ROLES,
  DAYS_OF_WEEK,
  PAY_TYPES,
  PAY_FREQUENCIES,
  TIME_OPTIONS,
} from '../src/widgets/AddTempStaffModal';

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
  useAuth: () => ({ gym: { _id: 'gym-123', partnerId: 'GYM-001', name: 'Test Gym' } }),
}));

jest.mock('../src/services/apiService', () => ({
  apiService: {
    createEmployee: jest.fn().mockResolvedValue({ message: 'Success' }),
  },
}));

jest.mock('../src/utils/filePickerUtils', () => ({
  pickImageFromDevice: jest.fn(),
  capturePhotoFromCamera: jest.fn(),
}));

describe('AddTempStaffModal Constants & Utilities', () => {
  test('TEMP_ROLES contains expected roles from Gym Owner Website', () => {
    expect(Array.isArray(TEMP_ROLES)).toBe(true);
    expect(TEMP_ROLES).toContain('Trainer');
    expect(TEMP_ROLES).toContain('Coach');
    expect(TEMP_ROLES).toContain('Yoga Instructor');
    expect(TEMP_ROLES).toContain('Zumba Instructor');
  });

  test('DAYS_OF_WEEK contains all 7 days', () => {
    expect(DAYS_OF_WEEK).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  test('PAY_TYPES contains Hourly, Session, Daily, Weekly, Monthly', () => {
    const keys = PAY_TYPES.map((p) => p.key);
    expect(keys).toContain('Hourly');
    expect(keys).toContain('Session');
    expect(keys).toContain('Daily');
    expect(keys).toContain('Weekly');
    expect(keys).toContain('Monthly');
  });

  test('PAY_FREQUENCIES contains standard payout frequencies', () => {
    expect(PAY_FREQUENCIES).toContain('Daily');
    expect(PAY_FREQUENCIES).toContain('Weekly');
    expect(PAY_FREQUENCIES).toContain('Monthly');
  });

  test('TIME_OPTIONS contains 30-min time slots', () => {
    expect(TIME_OPTIONS).toContain('06:00 AM');
    expect(TIME_OPTIONS).toContain('09:00 AM');
    expect(TIME_OPTIONS).toContain('06:00 PM');
  });
});

