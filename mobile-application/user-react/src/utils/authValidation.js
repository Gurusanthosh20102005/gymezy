/**
 * Shared authentication form validation helpers for user-react.
 * Keeps Sign In and Create Account validation rules in a single source of truth.
 */

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const PHONE_CHARS_REGEX = /^\+?[\d\s()-]+$/;
export const TEN_DIGIT_PHONE_REGEX = /^\d{10}$/;
export const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

export const PASSWORD_MIN_SIGN_IN = 6;
export const PASSWORD_MIN_SIGN_UP = 8;

/**
 * Normalizes a phone number by stripping non-digits and optional +91 / 91 / 0 prefix.
 */
export const normalizePhone = (rawPhone) => {
  if (!rawPhone) return '';
  let digits = String(rawPhone).trim().replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
};

export const validateFullName = (name) => {
  const cleanName = (name || '').trim();
  if (!cleanName || cleanName.length < 2) {
    return 'Please enter your full name (at least 2 characters)';
  }
  if (EMOJI_REGEX.test(cleanName)) {
    return 'Full name cannot contain emojis';
  }
  return null;
};

export const validateEmail = (email) => {
  const cleanEmail = (email || '').trim();
  if (!cleanEmail) {
    return 'Please enter your email address';
  }
  if (!EMAIL_REGEX.test(cleanEmail)) {
    return 'Please enter a valid email address';
  }
  return null;
};

export const validatePhone = (phone) => {
  const cleanPhone = (phone || '').trim();
  if (!cleanPhone) {
    return 'Please enter your phone number';
  }
  if (!PHONE_CHARS_REGEX.test(cleanPhone)) {
    return 'Phone number can only contain digits';
  }
  const normalized = normalizePhone(cleanPhone);
  if (!TEN_DIGIT_PHONE_REGEX.test(normalized)) {
    return 'Please enter a valid 10-digit phone number';
  }
  return null;
};

export const validateIdentifier = (identifier) => {
  const cleanId = (identifier || '').trim();
  if (!cleanId) {
    return 'Please enter your email or phone number';
  }
  if (cleanId.includes('@')) {
    return EMAIL_REGEX.test(cleanId) ? null : 'Please enter a valid email address';
  }
  if (/[a-zA-Z]/.test(cleanId)) {
    return 'Please enter a valid email address or 10-digit phone number';
  }
  return validatePhone(cleanId);
};

export const validatePassword = (password, { isSignUp = false } = {}) => {
  const value = password || '';
  if (!value) {
    return isSignUp ? 'Please choose a password' : 'Please enter your password';
  }
  if (!isSignUp) {
    return value.length < PASSWORD_MIN_SIGN_IN
      ? `Password must be at least ${PASSWORD_MIN_SIGN_IN} characters`
      : null;
  }
  if (value.length < PASSWORD_MIN_SIGN_UP) {
    return `Password must be at least ${PASSWORD_MIN_SIGN_UP} characters`;
  }
  if (!/[A-Z]/.test(value)) {
    return 'Password must include at least one uppercase letter';
  }
  if (!/[a-z]/.test(value)) {
    return 'Password must include at least one lowercase letter';
  }
  if (!/\d/.test(value)) {
    return 'Password must include at least one number';
  }
  return null;
};

export const validateSignInForm = ({ identifier, password }) => {
  const errors = {};
  const identifierError = validateIdentifier(identifier);
  const passwordError = validatePassword(password, { isSignUp: false });

  if (identifierError) errors.identifier = identifierError;
  if (passwordError) errors.password = passwordError;

  return errors;
};

export const validateSignUpForm = ({ fullName, email, phone, password }) => {
  const errors = {};
  const nameError = validateFullName(fullName);
  const emailError = validateEmail(email);
  const phoneError = validatePhone(phone);
  const passwordError = validatePassword(password, { isSignUp: true });

  if (nameError) errors.signupName = nameError;
  if (emailError) errors.signupEmail = emailError;
  if (phoneError) errors.signupPhone = phoneError;
  if (passwordError) errors.signupPassword = passwordError;

  return errors;
};
