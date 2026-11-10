import React from 'react';
import {
  AddEmployeeModal,
  ROLE_OPTIONS,
  ACCESS_LEVELS,
  PREV_EXP_OPTIONS,
  RELATION_OPTIONS,
  EMPLOYMENT_DOC_TYPES,
  PERSONAL_DOC_TYPES,
  TRAINER_CERT_TYPES,
  AVAILABLE_SERVICES,
  getServiceIconName,
  isManagerRole,
} from '../src/widgets/AddEmployeeModal';

// Mock dependencies
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
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
    updateEmployee: jest.fn().mockResolvedValue({ message: 'Updated' }),
  },
}));

jest.mock('../src/utils/filePickerUtils', () => ({
  pickImageFromDevice: jest.fn(),
  capturePhotoFromCamera: jest.fn(),
}));

describe('AddEmployeeModal Constants & Utilities', () => {
  test('ROLE_OPTIONS is defined and contains Manager (Operational Admin) and Staff roles', () => {
    expect(Array.isArray(ROLE_OPTIONS)).toBe(true);
    expect(ROLE_OPTIONS).toContain('Manager (Operational Admin)');
    expect(ROLE_OPTIONS).toContain('Trainer');
    expect(ROLE_OPTIONS).toContain('Front Desk Manager');
  });

  test('isManagerRole correctly identifies manager roles', () => {
    expect(isManagerRole('Manager')).toBe(true);
    expect(isManagerRole('Manager (Operational Admin)')).toBe(true);
    expect(isManagerRole('manager')).toBe(true);
    expect(isManagerRole('Trainer')).toBe(false);
    expect(isManagerRole('Front Desk Manager')).toBe(false);
    expect(isManagerRole('Customer Support')).toBe(false);
  });

  test('ACCESS_LEVELS contains Admin, Employee, and None', () => {
    expect(Array.isArray(ACCESS_LEVELS)).toBe(true);
    const values = ACCESS_LEVELS.map((lvl) => lvl.value);
    expect(values).toContain('Admin');
    expect(values).toContain('Employee');
    expect(values).toContain('None');
  });

  test('AVAILABLE_SERVICES contains standard gym offerings', () => {
    expect(Array.isArray(AVAILABLE_SERVICES)).toBe(true);
    expect(AVAILABLE_SERVICES.length).toBeGreaterThan(0);
    expect(AVAILABLE_SERVICES).toContain('Weight Loss Program');
    expect(AVAILABLE_SERVICES).toContain('Muscle Gain');
    expect(AVAILABLE_SERVICES).toContain('Strength Training');
  });

  test('EMPLOYMENT_DOC_TYPES, PERSONAL_DOC_TYPES, TRAINER_CERT_TYPES are defined', () => {
    expect(Array.isArray(EMPLOYMENT_DOC_TYPES)).toBe(true);
    expect(EMPLOYMENT_DOC_TYPES).toContain('Offer Letter');

    expect(Array.isArray(PERSONAL_DOC_TYPES)).toBe(true);
    expect(PERSONAL_DOC_TYPES).toContain('Aadhar Card');
    expect(PERSONAL_DOC_TYPES).toContain('PAN Card');

    expect(Array.isArray(TRAINER_CERT_TYPES)).toBe(true);
    expect(TRAINER_CERT_TYPES).toContain('CPT (Certified Personal Trainer)');
  });

  test('getServiceIconName maps service categories to appropriate icons', () => {
    expect(getServiceIconName('Weight Loss Program')).toBe('local-mall');
    expect(getServiceIconName('Muscle Gain')).toBe('fitness-center');
    expect(getServiceIconName('Cardio / HIIT')).toBe('directions-run');
    expect(getServiceIconName('Yoga & Mobility')).toBe('self-improvement');
    expect(getServiceIconName('CrossFit Training')).toBe('flash-on');
    expect(getServiceIconName('Diet & Nutrition')).toBe('restaurant');
    expect(getServiceIconName('Unknown Specialized Service')).toBe('fitness-center');
  });

  test('AddEmployeeModal is a valid React component function', () => {
    expect(typeof AddEmployeeModal).toBe('function');
  });

  test('AddEmployeeModal renders without crashing when visible is true', () => {
    const renderer = require('react-test-renderer');
    let component;
    renderer.act(() => {
      component = renderer.create(
        <AddEmployeeModal
          visible={true}
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      );
    });
    expect(component).toBeDefined();
    renderer.act(() => {
      component.unmount();
    });
  });

  test('AddEmployeeModal renders correctly when visible is false', () => {
    const renderer = require('react-test-renderer');
    let component;
    renderer.act(() => {
      component = renderer.create(
        <AddEmployeeModal
          visible={false}
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      );
    });
    expect(component).toBeDefined();
    renderer.act(() => {
      component.unmount();
    });
  });

  test('AddEmployeeModal renders Manager delegation permissions and password cards when Manager is selected', () => {
    const renderer = require('react-test-renderer');
    let component;
    renderer.act(() => {
      component = renderer.create(
        <AddEmployeeModal
          visible={true}
          defaultRole="Manager (Operational Admin)"
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      );
    });
    const root = component.root;
    // Check that Manager Delegation Permissions text is rendered
    const textNodes = root.findAllByType('Text');
    const texts = textNodes.map((n) => (typeof n.props.children === 'string' ? n.props.children : '')).filter(Boolean);
    const hasDelegation = texts.some((t) => t.includes('Manager Delegation Permissions'));
    expect(hasDelegation).toBe(true);

    const hasPasswordCard = texts.some((t) => t.includes('Manager Portal Login Password'));
    expect(hasPasswordCard).toBe(true);

    renderer.act(() => {
      component.unmount();
    });
  });

  test('AddEmployeeModal populates initialEmployee data for editing a Manager', () => {
    const renderer = require('react-test-renderer');
    const existingManager = {
      _id: 'emp-mgr-001',
      name: 'Sarah Connor',
      role: 'Manager',
      phone: '+91 9876543210',
      email: 'sarah@gym.com',
      accessType: 'Admin',
      managerPermissions: {
        requireStaffApproval: false,
        requirePlanSwitchApproval: true,
        requireCancellationApproval: true,
        requireProfileEditApproval: false,
      },
    };

    let component;
    renderer.act(() => {
      component = renderer.create(
        <AddEmployeeModal
          visible={true}
          initialEmployee={existingManager}
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      );
    });

    const root = component.root;
    const textNodes = root.findAllByType('Text');
    const texts = textNodes.map((n) => (typeof n.props.children === 'string' ? n.props.children : '')).filter(Boolean);
    expect(texts.some((t) => t.includes('Edit Employee Details'))).toBe(true);

    renderer.act(() => {
      component.unmount();
    });
  });
});
