export const EMOJI_STRIP_REGEX =
  /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}]/gu;

export const EMOJI_TEST_REGEX =
  /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}]/u;

export const MEDIA_FIELDS = new Set([
  'logo',
  'coverPhoto',
  'galleryPhotos',
  'gstCertificate',
  'businessCertificate',
  'businessLicense',
  'gstCertificateUrl',
  'brandLogoUrl',
  'coverPhotoUrl',
]);

/**
 * Strips all emoji and pictographic Unicode characters from a string.
 */
export const stripEmojis = (value) => {
  if (typeof value !== 'string') return value;
  return value.replace(EMOJI_STRIP_REGEX, '');
};

/**
 * Returns true if the value contains any emoji or pictographic character.
 */
export const containsEmoji = (value) => {
  if (typeof value !== 'string') return false;
  return EMOJI_TEST_REGEX.test(value);
};

/**
 * Digits only with NFKC normalization so full-width digits become ASCII digits.
 */
export const digitsOnly = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .replace(/\D/g, '');

// RFC 5322 / HTML Living Standard email regex tightened to require TLD >= 2 alpha chars
const EMAIL_REGEX =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

/**
 * Industry-standard email validation (form-input-validation core).
 * Returns an error message string if invalid, or '' if valid.
 */
export const validateEmail = (value) => {
  const str = String(value ?? '').trim();
  if (!str) return 'Email address is required';
  if (containsEmoji(str)) return 'Emojis are not allowed in email address';
  if (str.length > 254) return 'Email address cannot exceed 254 characters';
  const parts = str.split('@');
  if (parts.length !== 2) return 'Enter a valid email address (e.g. owner@gym.com)';
  const [localPart, domainPart] = parts;
  if (!localPart || !domainPart || localPart.length > 64) {
    return 'Enter a valid email address (e.g. owner@gym.com)';
  }
  if (
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    domainPart.includes('..')
  ) {
    return 'Enter a valid email address (e.g. owner@gym.com)';
  }
  if (!EMAIL_REGEX.test(str)) {
    return 'Enter a valid email address (e.g. owner@gym.com)';
  }
  return '';
};

/**
 * Industry-standard Indian 10-digit mobile phone validation.
 * Supports NFKC normalization, strips pasted +91/91/0 prefix when validating,
 * enforces starting digit 6-9, and rejects all-identical digits.
 * Returns an error message string if invalid, or '' if valid.
 */
export const validatePhone = (value) => {
  const raw = String(value ?? '')
    .normalize('NFKC')
    .trim();
  if (!raw) return 'Mobile number is required';
  if (containsEmoji(raw)) return 'Emojis are not allowed in mobile number';
  if (/[^\d\s().+-]/.test(raw)) {
    return 'Enter a valid 10-digit Indian mobile number (digits only)';
  }
  let digits = digitsOnly(raw);
  if (digits.startsWith('00') && digits.slice(2).startsWith('91')) {
    digits = digits.slice(2);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) return 'Must be a valid 10-digit mobile number';
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return 'Enter a valid Indian mobile number starting with 6-9';
  }
  if (/^(\d)\1{9}$/.test(digits)) {
    return 'Enter a valid mobile number (cannot be all identical digits)';
  }
  return '';
};

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\p{Zs}.'’-]*$/u;

/**
 * Industry-standard person name validation (letters, spaces, dots, apostrophes, hyphens; no emojis/numbers).
 */
export const validatePersonName = (value, label = 'Name', min = 2, max = 100) => {
  const raw = String(value ?? '');
  if (!raw.trim()) return `${label} is required`;
  if (containsEmoji(raw)) return `Emojis are not allowed in ${label}`;
  const normalized = raw.trim().replace(/\s+/g, ' ');
  const len = Array.from(normalized).length;
  if (len < min) return `${label} must be at least ${min} characters`;
  if (len > max) return `${label} must be ${max} characters or fewer`;
  if (!NAME_RE.test(normalized)) {
    return `${label} should use letters, spaces, dots, apostrophes or hyphens only`;
  }
  return '';
};

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  'passw0rd',
  'p@ssw0rd',
  'p@ssword',
  'p@ssword1',
  'password@123',
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  '111111',
  '000000',
  'qwerty',
  'qwerty123',
  'qwertyuiop',
  'abc123',
  'abcd1234',
  'iloveyou',
  'admin',
  'admin123',
  'admin@123',
  'welcome',
  'welcome1',
  'welcome@123',
  'letmein',
  'monkey',
  'dragon',
  'football',
  'baseball',
  'sunshine',
  'princess',
  'login',
  'starwars',
  '1q2w3e4r',
  'zaq12wsx',
  'changeme',
  'default',
  'master',
  'superman',
  'trustno1',
]);

/**
 * Industry-standard password validation (form-input-validation core):
 * 8-16 chars, ASCII-only (no emoji/whitespace), upper, number, symbol,
 * blocks common passwords and user identifiers (name/email/phone).
 */
export const validatePassword = (value, context = {}) => {
  const v = String(value ?? '');
  if (!v) return 'Password is required';
  if (containsEmoji(v) || !/^[\x20-\x7E]*$/.test(v)) {
    return 'Letters, numbers and symbols only (no emoji or accented letters)';
  }
  if (/\s/.test(v)) return 'Password cannot contain spaces';
  if (v.length < 8) return 'Password must be at least 8 characters';
  if (v.length > 16) return 'Password cannot exceed 16 characters';
  if (!/[A-Z]/.test(v)) return 'Must contain at least 1 uppercase letter';
  if (!/\d/.test(v)) return 'Must contain at least 1 number';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(v)) {
    return 'Must contain at least 1 special character';
  }
  if (COMMON_PASSWORDS.has(v.toLowerCase())) {
    return 'Choose a less common password';
  }
  const lower = v.toLowerCase();
  const sources = [
    context.email ? String(context.email).split('@')[0] : '',
    context.name ?? '',
  ];
  const tokens = [];
  for (const source of sources) {
    const whole = String(source).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    tokens.push(whole, ...String(source).toLowerCase().split(/[^\p{L}\p{N}]+/u));
  }
  if (tokens.filter((t) => t.length >= 3).some((t) => lower.includes(t))) {
    return 'Password should not contain your name or email';
  }
  const phoneDigits = digitsOnly(context.phone ?? '');
  if (phoneDigits.length >= 6 && lower.includes(phoneDigits.slice(-6))) {
    return 'Password should not contain your mobile number';
  }
  return '';
};

/**
 * Industry-standard Indian postal PIN code validation (6 digits, cannot start with 0).
 */
export const validatePostalCode = (value) => {
  const digits = digitsOnly(value);
  if (!digits) return 'Pincode is required';
  if (!/^[1-9]\d{5}$/.test(digits)) {
    return 'Enter a valid 6-digit Indian postal pincode (e.g. 600040)';
  }
  return '';
};

/**
 * Industry-standard UPI ID validation (optional field).
 */
export const validateUpiId = (value) => {
  const str = String(value ?? '').trim();
  if (!str) return '';
  if (containsEmoji(str)) return 'Emojis are not allowed in UPI ID';
  if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(str)) {
    return 'Invalid UPI ID format (e.g. name@okaxis)';
  }
  return '';
};

/**
 * Industry-standard bank account number validation (8 to 18 digits, rejects all-identical digits).
 */
export const validateAccountNumber = (value) => {
  const raw = String(value ?? '').normalize('NFKC').trim();
  if (!raw) return 'Account number is required';
  if (containsEmoji(raw)) return 'Emojis are not allowed in account number';
  if (/[^\d]/.test(raw)) return 'Account number must contain digits only';
  if (raw.length < 8 || raw.length > 18) {
    return 'Account number must be 8 to 18 digits';
  }
  if (/^(\d)\1+$/.test(raw)) {
    return 'Enter a valid bank account number (cannot be all identical digits)';
  }
  return '';
};

/**
 * Confirm bank account number validation.
 */
export const validateConfirmAccountNumber = (value, accountNumber) => {
  const raw = String(value ?? '').normalize('NFKC').trim();
  const acct = String(accountNumber ?? '').normalize('NFKC').trim();
  if (!raw) return 'Please confirm account number';
  if (raw !== acct) return 'Account numbers do not match';
  return '';
};
