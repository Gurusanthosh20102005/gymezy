// Adapted from .agents/skills/form-input-validation/assets/validation-core.mjs

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '12345678', '123456789',
  '1234567890', 'qwerty', 'qwerty123', 'abc123', 'letmein', 'welcome', 'admin',
  'admin123', 'iloveyou', 'monkey', 'dragon', 'baseball', 'football', 'princess',
  'sunshine', 'passw0rd', 'p@ssword', 'p@ssw0rd', '111111', '000000',
]);

export const PASSWORD_POLICY = Object.freeze({
  min: 8,
  max: 16,
  uppercase: true,
  lowercase: true,
  number: true,
  symbol: true,
  noWhitespace: true,
  asciiOnly: true,
  blockCommon: true,
  blockIdentifiers: true,
});

export const MOBILE_REGIONS = Object.freeze({
  IN: Object.freeze({
    dialCode: '91',
    trunkPrefix: '0',
    length: 10,
    pattern: /^[6-9]\d{9}$/,
    example: '98765 43210',
    hint: '10 digits, starting with 6, 7, 8 or 9',
  }),
  US: Object.freeze({
    dialCode: '1',
    trunkPrefix: '',
    length: 10,
    pattern: /^[2-9]\d{2}[2-9]\d{6}$/,
    example: '415 555 2671',
    hint: '10 digits: area code, then the number',
  }),
});

export function regionFromCountryCode(countryCode) {
  const code = String(countryCode || '').replace(/\D/g, '');
  if (code === '91') return 'IN';
  if (code === '1') return 'US';
  return null;
}

export function digitsOnly(value) {
  return String(value ?? '').normalize('NFKC').replace(/\D/g, '');
}

export function normalizeNational(value, regionCode = 'IN', { pasted = false } = {}) {
  const r = MOBILE_REGIONS[regionCode];
  let d = digitsOnly(value);
  if (!pasted || !r) return d;
  if (d.startsWith('00') && d.slice(2).startsWith(r.dialCode)) d = d.slice(2);
  if (d.length === r.length + r.dialCode.length && d.startsWith(r.dialCode)) {
    return d.slice(r.dialCode.length);
  }
  if (r.trunkPrefix && d.length === r.length + r.trunkPrefix.length && d.startsWith(r.trunkPrefix)) {
    return d.slice(r.trunkPrefix.length);
  }
  return d;
}

export function sanitizeMobile(value, regionCode = 'IN', { pasted = false, cap = true } = {}) {
  const r = MOBILE_REGIONS[regionCode];
  const d = normalizeNational(value, regionCode, { pasted });
  return r && cap ? d.slice(0, r.length) : d;
}

export function validateMobile(value, countryCodeOrRegion = 'IN') {
  const regionCode =
    MOBILE_REGIONS[countryCodeOrRegion]
      ? countryCodeOrRegion
      : regionFromCountryCode(countryCodeOrRegion);

  const raw = String(value ?? '').normalize('NFKC').trim();
  if (!raw) return fail('Enter your mobile number');
  if (/[^\d\s().+-]/.test(raw)) {
    const r = MOBILE_REGIONS[regionCode || 'IN'];
    return fail(`Enter a valid mobile number (${r.hint})`);
  }

  if (regionCode && MOBILE_REGIONS[regionCode]) {
    const r = MOBILE_REGIONS[regionCode];
    const national = normalizeNational(raw, regionCode, { pasted: true });
    if (!national) return fail('Enter your mobile number');
    if (national.length !== r.length) {
      return fail(`Mobile number must be ${r.length} digits (${r.hint})`);
    }
    if (!r.pattern.test(national)) {
      return fail(`Enter a valid mobile number (${r.hint})`);
    }
    return { valid: true, message: '', normalized: `+${r.dialCode}${national}`, national };
  }

  const d = digitsOnly(raw);
  if (d.length < 7 || d.length > 15) {
    return fail('Mobile number must be between 7 and 15 digits');
  }
  return { valid: true, message: '', normalized: `+${String(countryCodeOrRegion).replace(/\D/g, '')}${d}`, national: d };
}

const EMAIL_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function validateEmail(value, { required = true } = {}) {
  const v = String(value ?? '').trim();
  if (!v) {
    return required ? fail('Enter your email address') : { valid: true, message: '', normalized: '' };
  }
  if (v.length > 254 || v.split('@')[0].length > 64) {
    return fail('That email address is too long');
  }
  if (!EMAIL_RE.test(v) || v.includes('..') || /^\.|\.@/.test(v)) {
    return fail('Enter a valid email address, like name@example.com');
  }
  return { valid: true, message: '', normalized: v.toLowerCase() };
}

// Unicode letters/marks/spaces/dots/apostrophes/hyphens (safe fallback if Hermes lacks \p{L})
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\p{Zs}.'’-]*$/u;

export function validateName(value, { label = 'name', max = 100 } = {}) {
  const v = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!v) return fail(`Enter your ${label}`);
  if (Array.from(v).length > max) return fail(`Use ${max} characters or fewer`);
  if (!NAME_RE.test(v)) return fail('Use letters, spaces, hyphens or apostrophes only');
  return { valid: true, message: '', normalized: v };
}

function containsIdentifier(password, { name, email, mobile, username } = {}) {
  const lower = String(password).toLowerCase();
  const sources = [email ? String(email).split('@')[0] : '', username ?? '', name ?? ''];
  const tokens = [];
  for (const source of sources) {
    const whole = String(source).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    tokens.push(whole, ...String(source).toLowerCase().split(/[^\p{L}\p{N}]+/u));
  }
  const found = tokens.filter((t) => t.length >= 3).some((t) => lower.includes(t));
  const digits = digitsOnly(mobile ?? '');
  return found || (digits.length >= 6 && lower.includes(digits.slice(-6)));
}

export function checkPassword(value, context = {}, policy = {}) {
  const p = { ...PASSWORD_POLICY, ...policy };
  const v = String(value ?? '');
  const len = Array.from(v).length;
  const rules = [];
  const add = (id, label, passed, message, required = true, silentPass = false) =>
    rules.push({ id, label, passed, message, required, silentPass });

  add('length', `${p.min} to ${p.max} characters`, len >= p.min && len <= p.max,
    len < p.min ? `Use at least ${p.min} characters` : `Use ${p.max} characters or fewer`);
  if (p.uppercase) add('upper', 'An uppercase letter', /[A-Z]/.test(v), 'Add an uppercase letter');
  if (p.lowercase) add('lower', 'A lowercase letter', /[a-z]/.test(v), 'Add a lowercase letter');
  if (p.number) add('number', 'A number', /\d/.test(v), 'Add a number');
  if (p.symbol) add('symbol', 'A symbol (for example !@#$)', /[^A-Za-z0-9\s]/.test(v), 'Add a symbol');
  if (p.noWhitespace) add('no-space', 'No spaces', !/\s/.test(v), 'Remove spaces', true, true);
  if (p.asciiOnly) add('ascii', 'Standard keyboard characters only', /^[\x21-\x7E]*$/.test(v), 'Use standard keyboard characters only', true, true);
  if (p.blockCommon) {
    add('not-common', 'Not a common password', !COMMON_PASSWORDS.has(v.toLowerCase()), 'Choose a less common password', true, true);
  }
  if (p.blockIdentifiers) {
    add('not-identifier', 'Does not contain your name, email or phone number', !containsIdentifier(v, context),
      'Do not include your name, email or phone number', true, true);
  }
  const failed = rules.find((r) => !r.passed);
  const message = v === '' ? 'Create a password' : failed ? failed.message : '';
  return { valid: !failed, rules, message };
}

export function validatePositiveNumber(value, { label = 'amount', min = 1, max = 1000000 } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return fail(`Enter ${label}`);
  const num = Number(raw);
  if (!Number.isFinite(num) || num < min) return fail(`Enter a valid ${label} (at least ${min})`);
  if (num > max) return fail(`${label} cannot exceed ${max}`);
  return { valid: true, message: '', normalized: num };
}

export function validateDateString(value, label = 'date') {
  const v = String(value ?? '').trim();
  if (!v) return fail(`Select ${label}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return fail(`Use YYYY-MM-DD format for ${label}`);
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fail(`Enter a valid ${label}`);
  return { valid: true, message: '', normalized: v };
}

export function parseTimeToMinutes(timeStr) {
  const match = String(timeStr ?? '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + mins;
}

export function validateTimeRange(startStr, endStr) {
  const start = parseTimeToMinutes(startStr);
  const end = parseTimeToMinutes(endStr);
  if (start === null || end === null) return fail('Select valid start and end times');
  if (end <= start) return fail('End time must be after start time');
  return { valid: true, message: '' };
}

function fail(message) {
  return { valid: false, message, normalized: '' };
}
