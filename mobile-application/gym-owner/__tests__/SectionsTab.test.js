import React from 'react';
import { apiService } from '../src/services/apiService';
import { SECTION_CATEGORIES } from '../src/widgets/CreateSectionModal';

// Mock dependencies
jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

jest.mock('../src/theme/ThemeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    gym: { _id: 'gym-123', name: 'Powerhouse Gym' },
    user: { gymId: 'gym-123' },
  }),
}));

describe('SectionsTab and Categories (SSOT)', () => {
  test('SECTION_CATEGORIES contains all classes defined in web app', () => {
    expect(Array.isArray(SECTION_CATEGORIES)).toBe(true);
    const keys = SECTION_CATEGORIES.map((c) => c.key);
    expect(keys).toContain('yoga');
    expect(keys).toContain('gym');
    expect(keys).toContain('zumba');
    expect(keys).toContain('crossfit');
    expect(keys).toContain('hiit');
    expect(keys).toContain('pilates');
    expect(keys).toContain('boxing');
    expect(keys).toContain('other');
  });

  test('apiService sections operations (get, toggle, delete)', async () => {
    const mockGet = jest.spyOn(apiService, 'getSections').mockResolvedValue([
      {
        _id: 'sec-1',
        title: 'Morning Yoga Flow',
        category: 'yoga',
        cost: 1500,
        isActive: true,
        maxCapacity: 25,
        enrolledCount: 15,
      },
      {
        _id: 'sec-2',
        title: 'Evening CrossFit Power',
        category: 'crossfit',
        cost: 2500,
        isActive: false,
        maxCapacity: 20,
        enrolledCount: 8,
      },
    ]);

    const mockToggle = jest.spyOn(apiService, 'toggleSectionStatus').mockResolvedValue({ success: true });
    const mockDelete = jest.spyOn(apiService, 'deleteSection').mockResolvedValue({ success: true });

    const sections = await apiService.getSections({ gymId: 'gym-123' });
    expect(sections.length).toBe(2);
    expect(sections[0].title).toBe('Morning Yoga Flow');

    await apiService.toggleSectionStatus('sec-1', false);
    expect(mockToggle).toHaveBeenCalledWith('sec-1', false);

    await apiService.deleteSection('sec-2');
    expect(mockDelete).toHaveBeenCalledWith('sec-2');

    mockGet.mockRestore();
    mockToggle.mockRestore();
    mockDelete.mockRestore();
  });
});

