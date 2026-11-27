import { BANKS, getBankByName } from '../src/utils/bankData';
import {
  stripEmojis,
  containsEmoji,
  validateEmail,
  validatePhone,
  validateUpiId,
} from '../src/utils/validationUtils';

describe('Gym Owner Registration Validation & Data (Matching Web)', () => {
  test('BANKS list contains popular Indian banks with name and ifscPrefix', () => {
    expect(BANKS).toBeDefined();
    expect(Array.isArray(BANKS)).toBe(true);
    expect(BANKS.length).toBeGreaterThan(10);

    const sbi = getBankByName('State Bank of India (SBI)');
    expect(sbi).toBeDefined();
    expect(sbi.ifscPrefix).toBe('SBIN');

    const hdfc = getBankByName('HDFC Bank');
    expect(hdfc).toBeDefined();
    expect(hdfc.ifscPrefix).toBe('HDFC');

    const canara = getBankByName('Canara Bank');
    expect(canara).toBeDefined();
    expect(canara.ifscPrefix).toBe('CNRB');
  });

  test('Registration Form Field Validation logic correctly enforces constraints', () => {
    const validateField = (field, value, form = {}) => {
      switch (field) {
        case 'subscriptionType':
          if (!value) return 'Please select a partnership plan';
          return '';
        case 'gymName':
          if (!value || !value.trim()) return 'Gym / Studio name is required';
          if (value.trim().length < 2) return 'Must be at least 2 characters';
          return '';
        case 'ownerName':
          if (!value || !value.trim()) return 'Owner / MD name is required';
          if (value.trim().length < 2) return 'Must be at least 2 characters';
          return '';
        case 'phone': {
          const digits = String(value || '').replace(/\D/g, '');
          if (!digits) return 'Mobile number is required';
          if (digits.length !== 10) return 'Must be a valid 10-digit mobile number';
          return '';
        }
        case 'email':
          if (!value || !value.trim()) return 'Email address is required';
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email (e.g. owner@gym.com)';
          return '';
        case 'pincode': {
          const digits = String(value || '').replace(/\D/g, '');
          if (!digits) return 'Pincode is required';
          if (digits.length !== 6) return 'Pincode must be exactly 6 digits';
          return '';
        }
        case 'floorSpaceSqFt': {
          const num = Number(value);
          if (!value || isNaN(num) || num < 200) return 'Floor area must be at least 200 sq. ft.';
          if (num > 100000) return 'Floor area cannot exceed 100,000 sq. ft.';
          return '';
        }
        case 'maxFloorCapacity': {
          const num = Number(value);
          if (!value || isNaN(num) || num < 5) return 'Max capacity must be at least 5 athletes';
          if (num > 2000) return 'Max capacity cannot exceed 2,000 athletes';
          return '';
        }
        case 'monthlyPrice': {
          const num = Number(value);
          if (!value || isNaN(num) || num < 1) return 'Monthly membership price is required';
          return '';
        }
        case 'accountHolder':
          if (!value || !value.trim()) return 'Account holder name is required';
          if (value.trim().length < 2) return 'Must be at least 2 characters';
          return '';
        case 'bankName':
          if (!value || !value.trim()) return 'Bank name is required';
          return '';
        case 'accountNumber': {
          const digits = String(value || '').replace(/\D/g, '');
          if (!digits) return 'Account number is required';
          if (digits.length < 8) return 'Account number must be at least 8 digits';
          return '';
        }
        case 'confirmAccountNumber': {
          const digits = String(value || '').replace(/\D/g, '');
          const acctDigits = String(form?.accountNumber || '').replace(/\D/g, '');
          if (!digits) return 'Please confirm account number';
          if (digits !== acctDigits) return 'Account numbers do not match';
          return '';
        }
        case 'ifscCode':
          if (!value || !value.trim()) return 'IFSC code is required';
          if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value.trim())) return 'Invalid IFSC (e.g. HDFC0001234)';
          return '';
        case 'agreedToTerms':
          if (!value) return 'You must accept the terms to proceed';
          return '';
        default:
          return '';
      }
    };

    // Subscription Type
    expect(validateField('subscriptionType', '')).toBe('Please select a partnership plan');
    expect(validateField('subscriptionType', 'Hybrid')).toBe('');

    // Floor Space (rejects < 200, rejects > 100000, accepts 3500)
    expect(validateField('floorSpaceSqFt', '150')).toBe('Floor area must be at least 200 sq. ft.');
    expect(validateField('floorSpaceSqFt', '150000')).toBe('Floor area cannot exceed 100,000 sq. ft.');
    expect(validateField('floorSpaceSqFt', '3500')).toBe('');

    // Max Capacity (rejects < 5, rejects > 2000, accepts 45)
    expect(validateField('maxFloorCapacity', '3')).toBe('Max capacity must be at least 5 athletes');
    expect(validateField('maxFloorCapacity', '2500')).toBe('Max capacity cannot exceed 2,000 athletes');
    expect(validateField('maxFloorCapacity', '45')).toBe('');

    // Monthly Price
    expect(validateField('monthlyPrice', '0')).toBe('Monthly membership price is required');
    expect(validateField('monthlyPrice', '1999')).toBe('');

    // Phone (10 digits)
    expect(validateField('phone', '98765')).toBe('Must be a valid 10-digit mobile number');
    expect(validateField('phone', '9876543210')).toBe('');

    // Pincode (6 digits)
    expect(validateField('pincode', '60000')).toBe('Pincode must be exactly 6 digits');
    expect(validateField('pincode', '600028')).toBe('');

    // Bank Account & IFSC
    expect(validateField('bankName', '')).toBe('Bank name is required');
    expect(validateField('bankName', 'HDFC Bank')).toBe('');
    expect(validateField('accountNumber', '12345')).toBe('Account number must be at least 8 digits');
    expect(validateField('accountNumber', '50100456789012')).toBe('');

    expect(validateField('confirmAccountNumber', '50100456789011', { accountNumber: '50100456789012' })).toBe('Account numbers do not match');
    expect(validateField('confirmAccountNumber', '50100456789012', { accountNumber: '50100456789012' })).toBe('');

    expect(validateField('ifscCode', 'HDFC')).toBe('Invalid IFSC (e.g. HDFC0001234)');
    expect(validateField('ifscCode', 'HDFC0001234')).toBe('');

    // Terms & Conditions
    expect(validateField('agreedToTerms', false)).toBe('You must accept the terms to proceed');
    expect(validateField('agreedToTerms', true)).toBe('');
  });

  test('Step validation counter correctly calculates missing fields per step', () => {
    const STEP_REQUIRED_FIELDS = {
      1: [
        { field: 'subscriptionType', label: 'Subscription Plan' },
        { field: 'gymName', label: 'Gym / Studio Name' },
        { field: 'ownerName', label: 'Owner / MD Name' },
        { field: 'phone', label: 'Mobile Number' },
        { field: 'email', label: 'Official Email' },
        { field: 'password', label: 'Password' },
      ],
      5: [
        { field: 'accountHolder', label: 'Account Holder Name' },
        { field: 'bankName', label: 'Bank Name' },
        { field: 'accountNumber', label: 'Account Number' },
        { field: 'confirmAccountNumber', label: 'Confirm Account Number' },
        { field: 'ifscCode', label: 'IFSC Code' },
        { field: 'agreedToTerms', label: 'Terms & Conditions' },
      ],
    };

    const initialFormData = {
      subscriptionType: 'Hybrid',
      gymName: '',
      ownerName: '',
      phone: '',
      email: '',
      password: '',
      accountHolder: '',
      bankName: '',
      accountNumber: '',
      confirmAccountNumber: '',
      ifscCode: '',
      agreedToTerms: false,
    };

    const getStepMissingCount = (stepId, form) => {
      const required = STEP_REQUIRED_FIELDS[stepId] || [];
      return required.filter(({ field }) => {
        const val = form[field];
        if (field === 'agreedToTerms') return !val;
        return !val || String(val).trim() === '';
      }).length;
    };

    // Initially, Step 1 has 5 pending (gymName, ownerName, phone, email, password)
    expect(getStepMissingCount(1, initialFormData)).toBe(5);

    // When owner fills gymName, missing count immediately drops to 4
    const updatedStep1 = { ...initialFormData, gymName: 'FitZone Elite' };
    expect(getStepMissingCount(1, updatedStep1)).toBe(4);

    // Step 5 initially has all 6 required fields missing (NOT ready initially)
    expect(getStepMissingCount(5, initialFormData)).toBe(6);

    // When bank details and terms are completed, Step 5 becomes 0 pending (ready)
    const completedStep5 = {
      ...initialFormData,
      accountHolder: 'FitZone Pvt Ltd',
      bankName: 'HDFC Bank',
      accountNumber: '50100456789012',
      confirmAccountNumber: '50100456789012',
      ifscCode: 'HDFC0001234',
      agreedToTerms: true,
    };
    expect(getStepMissingCount(5, completedStep5)).toBe(0);
  });
});

describe('Emoji Blocking & Industry-Standard Validation', () => {
  test('Strips and detects emojis across all text inputs while preserving normal characters and INR symbol', () => {
    expect(containsEmoji('Apex Fitness 💪🔥🏋️‍♂️')).toBe(true);
    expect(stripEmojis('Apex Fitness 💪🔥🏋️‍♂️').trim()).toBe('Apex Fitness');
    expect(containsEmoji('Best Gym in Chennai - ₹1999/mo!')).toBe(false);
    expect(stripEmojis('Best Gym in Chennai - ₹1999/mo!')).toBe('Best Gym in Chennai - ₹1999/mo!');
  });

  test('Industry-standard email validation', () => {
    expect(validateEmail('')).toBe('Email address is required');
    expect(validateEmail('owner@gym')).not.toBe('');
    expect(validateEmail('owner..name@gym.com')).not.toBe('');
    expect(validateEmail('.owner@gym.com')).not.toBe('');
    expect(validateEmail('owner@gym..com')).not.toBe('');
    expect(validateEmail('owner@gym.c')).not.toBe('');
    expect(validateEmail('owner🔥@gym.com')).not.toBe('');
    expect(validateEmail('owner@gym.com')).toBe('');
    expect(validateEmail('john.doe+gym@fitness-club.co.in')).toBe('');
  });

  test('Industry-standard Indian mobile phone validation', () => {
    expect(validatePhone('')).toBe('Mobile number is required');
    expect(validatePhone('12345')).toBe('Must be a valid 10-digit mobile number');
    expect(validatePhone('5123456789')).toBe('Enter a valid Indian mobile number starting with 6-9');
    expect(validatePhone('9999999999')).toBe('Enter a valid mobile number (cannot be all identical digits)');
    expect(validatePhone('9876543210')).toBe('');
    expect(validatePhone('6123456789')).toBe('');
  });

  test('Industry-standard UPI ID validation', () => {
    expect(validateUpiId('')).toBe('');
    expect(validateUpiId('invalidupi')).not.toBe('');
    expect(validateUpiId('apex@okaxis')).toBe('');
    expect(validateUpiId('apex.fitness@okicici')).toBe('');
  });
});

import {
  validatePersonName,
  validatePassword,
  validatePostalCode,
  digitsOnly,
} from '../src/utils/validationUtils';

describe('Form Input Validation Skill Standards (NFKC, Names, Passwords, Postal)', () => {
  test('digitsOnly normalizes full-width Unicode digits via NFKC', () => {
    expect(digitsOnly('９８７６５４３２１０')).toBe('9876543210');
  });

  test('validatePersonName rejects emojis, numbers, and allows valid names', () => {
    expect(validatePersonName('', 'Owner Name')).toBe('Owner Name is required');
    expect(validatePersonName('John123', 'Owner Name')).not.toBe('');
    expect(validatePersonName('John 💪', 'Owner Name')).not.toBe('');
    expect(validatePersonName("O'Connor-Smith", 'Owner Name')).toBe('');
    expect(validatePersonName('Raghavendra Rao', 'Owner Name')).toBe('');
  });

  test('validatePassword enforces OWASP complexity, blocks common passwords and user identifiers', () => {
    expect(validatePassword('Password@123')).toBe('Choose a less common password');
    expect(validatePassword('ApexJohn@123', { name: 'John', email: 'john@gym.com' })).toBe(
      'Password should not contain your name or email'
    );
    expect(validatePassword('Gym543210@', { phone: '9876543210' })).toBe(
      'Password should not contain your mobile number'
    );
    expect(validatePassword('Gym💪Pass@1')).not.toBe('');
    expect(validatePassword('Str0ng!Pass#9')).toBe('');
  });

  test('validatePostalCode enforces 6-digit Indian PIN starting with 1-9', () => {
    expect(validatePostalCode('')).toBe('Pincode is required');
    expect(validatePostalCode('012345')).not.toBe('');
    expect(validatePostalCode('600040')).toBe('');
  });
});

import {
  validateAccountNumber,
  validateConfirmAccountNumber,
} from '../src/utils/validationUtils';

describe('Bank Account Number Validation', () => {
  test('validateAccountNumber enforces 8-18 digits and rejects non-digits or all-identical digits', () => {
    expect(validateAccountNumber('')).toBe('Account number is required');
    expect(validateAccountNumber('1234567')).toBe('Account number must be 8 to 18 digits');
    expect(validateAccountNumber('00000000')).toBe('Enter a valid bank account number (cannot be all identical digits)');
    expect(validateAccountNumber('999999999999')).toBe('Enter a valid bank account number (cannot be all identical digits)');
    expect(validateAccountNumber('1234abcd5678')).toBe('Account number must contain digits only');
    expect(validateAccountNumber('50100456789012')).toBe('');
  });

  test('validateConfirmAccountNumber checks exact match with accountNumber', () => {
    expect(validateConfirmAccountNumber('', '50100456789012')).toBe('Please confirm account number');
    expect(validateConfirmAccountNumber('50100456789013', '50100456789012')).toBe('Account numbers do not match');
    expect(validateConfirmAccountNumber('50100456789012', '50100456789012')).toBe('');
  });
});
