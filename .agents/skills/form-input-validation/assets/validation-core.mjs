/**
 * validation-core.mjs
 *
 * Framework-agnostic validation rules, sanitizers and checkers. No dependencies, no DOM.
 *
 * This is the ONE place the rules live. The browser (live validation) and the server (the
 * authority) import the same file, so they can never disagree. Copy it into the project's
 * shared folder, change the policy values below, and keep the function names.
 *
 * Every validator returns { valid, message, normalized }:
 *   valid       true or false
 *   message     what to tell the person ("" when valid)
 *   normalized  the cleaned value to store or send (trimmed, digits only, E.164 ...)
 */

// ------------------------------------------------------------------------------------------
// Messages: one catalog, so wording is consistent and easy to translate.
// ------------------------------------------------------------------------------------------
export const MESSAGES = Object.freeze({
  required: (label) => `Enter your ${label}`,
  nameChars: () => "Use letters, spaces, apostrophes and hyphens only",
  nameLength: (max) => `Use ${max} characters or fewer`,
  emailInvalid: () => "Enter an email address like name@company.com",
  emailLength: () => "That email address is too long",
  mobileLength: (r) => `Enter a ${r.length}-digit mobile number`,
  mobileFormat: (r) => `Enter a valid mobile number: ${r.hint}`,
  otpLength: (n) => `Enter the ${n}-digit code`,
  usernameInvalid: (min, max) =>
    `Use ${min} to ${max} letters, numbers, dots, underscores or hyphens, starting and ending with a letter or number`,
  postalInvalid: (r) => `Enter a valid ${r.label}`,
  cardInvalid: () => "Check the card number",
  pwTooShort: (p) => `Use at least ${p.minLength} characters`,
  pwTooLong: (p) => `Use at most ${p.maxLength} characters`,
  pwLength: (p) => `${p.minLength} to ${p.maxLength} characters`,
  pwUpper: () => "One uppercase letter (A to Z)",
  pwLower: () => "One lowercase letter (a to z)",
  pwNumber: () => "One number (0 to 9)",
  pwSymbol: (p) => `One symbol, such as ${[...p.symbols].slice(0, 6).join(" ")}`,
  pwNoSpace: () => "No spaces",
  pwCharset: () => "Letters, numbers and symbols only (no emoji or accented letters)",
  pwCommon: () => "Not a commonly used password",
  pwIdentifier: () => "Does not contain your name, email or phone number",
  pwMismatch: () => "The passwords do not match",
  pwRequired: () => "Enter a password",
});

// ------------------------------------------------------------------------------------------
// Password policy. Change the values here and nowhere else.
// Default: 8 to 16 characters with an uppercase letter, a lowercase letter, a number and a symbol.
// ------------------------------------------------------------------------------------------
export const PASSWORD_POLICY = Object.freeze({
  minLength: 8,
  maxLength: 16,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true,
  // OWASP's list of special characters. A symbol is any one of these.
  symbols: "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
  allowWhitespace: false,
  asciiOnly: true,    // letters, numbers and the symbols above; no emoji or accented letters
  blockCommon: true,  // reject well-known passwords (use a bigger list or a breach check on the server)
  blockIdentifiers: true, // reject passwords containing the person's name, email name or phone number
});

// A very small sample list. Complexity rules still allow "Password@123", so the server should check
// a larger list (the top 10,000 or more) or a breached-password service. See references/password-policy.md.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "p@ssw0rd", "p@ssword", "p@ssword1", "password@123",
  "123456", "12345678", "123456789", "1234567890", "111111", "000000", "qwerty", "qwerty123", "qwertyuiop",
  "abc123", "abcd1234", "iloveyou", "admin", "admin123", "admin@123", "welcome", "welcome1", "welcome@123",
  "letmein", "monkey", "dragon", "football", "baseball", "sunshine", "princess", "login", "starwars",
  "1q2w3e4r", "zaq12wsx", "changeme", "default", "master", "superman", "trustno1",
]);

export function isCommonPassword(value) {
  return COMMON_PASSWORDS.has(String(value ?? "").toLowerCase());
}

/**
 * Check a password against the policy.
 * Returns every rule with its state so a UI can show a live checklist.
 *   context: { name, email, mobile, username } for the "contains your details" rule.
 * Never trims or alters the password.
 */
export function checkPassword(value, policy = PASSWORD_POLICY, context = {}) {
  const p = { ...PASSWORD_POLICY, ...policy };
  const v = String(value ?? "");
  const chars = Array.from(v);
  const rules = [];
  // hard: the failure cannot be fixed by typing more (too long, a space, a banned character, a common
  // password). A live checklist can show those as failed at once; the others stay "pending" until the
  // person leaves the field or submits.
  // quiet: a negative rule ("no spaces", "not a common password"). A checklist lists it only while it fails,
  // so the person sees the positive requirements, not a wall of things they are not doing.
  const add = (id, label, passed, failMessage, hard = false, quiet = false) =>
    rules.push({ id, label, passed, message: passed ? "" : failMessage, hard: !passed && hard, quiet });

  add(
    "length",
    MESSAGES.pwLength(p),
    chars.length >= p.minLength && chars.length <= p.maxLength,
    chars.length > p.maxLength ? MESSAGES.pwTooLong(p) : MESSAGES.pwTooShort(p),
    chars.length > p.maxLength,
  );
  const upper = p.asciiOnly ? /[A-Z]/ : /\p{Lu}/u;
  const lower = p.asciiOnly ? /[a-z]/ : /\p{Ll}/u;
  const digit = p.asciiOnly ? /[0-9]/ : /\p{Nd}/u;
  if (p.requireUppercase) add("uppercase", MESSAGES.pwUpper(), upper.test(v), "Add an uppercase letter");
  if (p.requireLowercase) add("lowercase", MESSAGES.pwLower(), lower.test(v), "Add a lowercase letter");
  if (p.requireNumber) add("number", MESSAGES.pwNumber(), digit.test(v), "Add a number");
  if (p.requireSymbol) {
    add("symbol", MESSAGES.pwSymbol(p), chars.some((c) => p.symbols.includes(c)), "Add a symbol, such as ! @ # $ %");
  }
  if (!p.allowWhitespace) add("no-space", MESSAGES.pwNoSpace(), !/\s/.test(v), "Remove the spaces", true, true);
  if (p.asciiOnly) {
    const ok = p.allowWhitespace ? /^[\x20-\x7E]*$/ : /^[\x21-\x7E]*$/;
    // Spaces have their own rule, so the charset rule only fails for characters outside printable ASCII.
    add("charset", MESSAGES.pwCharset(), ok.test(v) || (!p.allowWhitespace && /^[\x20-\x7E]*$/.test(v)),
      "Use letters, numbers and symbols only (no emoji or accented letters)", true, true);
  }
  if (p.blockCommon) add("not-common", MESSAGES.pwCommon(), !isCommonPassword(v), "Choose a less common password", true, true);
  if (p.blockIdentifiers) {
    add("not-identifier", MESSAGES.pwIdentifier(), !containsIdentifier(v, context),
      "Do not include your name, email or phone number", true, true);
  }
  const failed = rules.find((r) => !r.passed);
  const message = v === "" ? MESSAGES.pwRequired() : failed ? failed.message : "";
  return { valid: !failed, rules, message };
}

function containsIdentifier(password, { name, email, mobile, username } = {}) {
  const lower = String(password).toLowerCase();
  const sources = [email ? String(email).split("@")[0] : "", username ?? "", name ?? ""];
  const tokens = [];
  for (const source of sources) {
    const whole = String(source).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    tokens.push(whole, ...String(source).toLowerCase().split(/[^\p{L}\p{N}]+/u)); // "priya.raman" gives priyaraman, priya, raman
  }
  const found = tokens.filter((t) => t.length >= 3).some((t) => lower.includes(t));
  const digits = digitsOnly(mobile ?? "");
  return found || (digits.length >= 6 && lower.includes(digits.slice(-6)));
}

/** Confirm-password check. Compare the raw values; never trim. */
export function validatePasswordConfirm(password, confirm) {
  const valid = String(password ?? "") === String(confirm ?? "") && String(confirm ?? "") !== "";
  return { valid, message: valid ? "" : MESSAGES.pwMismatch(), normalized: confirm };
}

// ------------------------------------------------------------------------------------------
// Mobile numbers
// For one or two known countries the table below is enough. For international input use a
// maintained library (libphonenumber-js) instead of extending this table. See references/field-rules.md.
// ------------------------------------------------------------------------------------------
export const MOBILE_REGIONS = Object.freeze({
  IN: Object.freeze({
    dialCode: "91", trunkPrefix: "0", length: 10, pattern: /^[6-9]\d{9}$/,
    example: "98765 43210", hint: "10 digits, starting with 6, 7, 8 or 9",
  }),
  US: Object.freeze({
    dialCode: "1", trunkPrefix: "", length: 10, pattern: /^[2-9]\d{2}[2-9]\d{6}$/,
    example: "415 555 2671", hint: "10 digits: area code, then the number",
  }),
});

/** Digits only. NFKC first, so full-width digits typed on some keyboards become ordinary digits. */
export function digitsOnly(value) {
  return String(value ?? "").normalize("NFKC").replace(/\D/g, "");
}

/**
 * Clean a mobile number into national digits.
 * pasted=true also strips a pasted country code (+91..., 0091...) or trunk prefix (0...) when the rest is
 * exactly a full national number. Never use pasted=true for typed characters: typing "91" then more digits
 * must not be rewritten.
 */
export function normalizeNational(value, regionCode = "IN", { pasted = false } = {}) {
  const r = MOBILE_REGIONS[regionCode];
  let d = digitsOnly(value);
  if (!pasted || !r) return d;
  if (d.startsWith("00") && d.slice(2).startsWith(r.dialCode)) d = d.slice(2);
  if (d.length === r.length + r.dialCode.length && d.startsWith(r.dialCode)) return d.slice(r.dialCode.length);
  if (r.trunkPrefix && d.length === r.length + r.trunkPrefix.length && d.startsWith(r.trunkPrefix)) {
    return d.slice(r.trunkPrefix.length);
  }
  return d;
}

/**
 * Sanitizer for a mobile input: digits only, capped at the national length.
 * cap: false returns the uncapped digits. restrictInput() in dom-helpers.mjs needs that form, because it
 * applies the cap itself and must be able to tell that one more digit would go over it.
 */
export function sanitizeMobile(value, regionCode = "IN", { pasted = false, cap = true } = {}) {
  const r = MOBILE_REGIONS[regionCode];
  const d = normalizeNational(value, regionCode, { pasted });
  return r && cap ? d.slice(0, r.length) : d;
}

export function validateMobile(value, regionCode = "IN") {
  const r = MOBILE_REGIONS[regionCode];
  const raw = String(value ?? "").normalize("NFKC").trim();
  if (!raw) return fail(MESSAGES.required("mobile number"));
  // Formatting characters (spaces, dashes, dots, brackets, +) are normalized away. Letters are not:
  // the field cannot produce them, so if they arrive the request was tampered with. Reject, never strip.
  if (/[^\d\s().+-]/.test(raw)) return fail(MESSAGES.mobileFormat(r));
  const national = normalizeNational(raw, regionCode, { pasted: true });
  if (!national) return fail(MESSAGES.required("mobile number"));
  if (national.length !== r.length) return fail(MESSAGES.mobileLength(r));
  if (!r.pattern.test(national)) return fail(MESSAGES.mobileFormat(r));
  return { valid: true, message: "", normalized: `+${r.dialCode}${national}` }; // E.164, ready to store
}

/** Shape check for an E.164 number (+ then up to 15 digits, no leading zero). It does not prove the number exists. */
export function isE164(value) {
  return /^\+[1-9]\d{1,14}$/.test(String(value ?? ""));
}

// ------------------------------------------------------------------------------------------
// Email, names, usernames, codes, postal codes, cards
// ------------------------------------------------------------------------------------------
// The HTML Living Standard's address pattern, tightened to require a dot in the domain.
const EMAIL_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function validateEmail(value) {
  const v = String(value ?? "").trim();
  if (!v) return fail(MESSAGES.required("email address"));
  if (v.length > 254 || v.split("@")[0].length > 64) return fail(MESSAGES.emailLength());
  if (!EMAIL_RE.test(v) || v.includes("..") || /^\.|\.@/.test(v)) return fail(MESSAGES.emailInvalid());
  return { valid: true, message: "", normalized: v.toLowerCase() };
}

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\p{Zs}.'’-]*$/u;

/** Names: any language, never "letters A to Z only". Trims and collapses repeated spaces. */
export function validateName(value, { label = "name", max = 100 } = {}) {
  const v = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!v) return fail(MESSAGES.required(label));
  if (Array.from(v).length > max) return fail(MESSAGES.nameLength(max));
  if (!NAME_RE.test(v)) return fail(MESSAGES.nameChars());
  return { valid: true, message: "", normalized: v };
}

export function validateOtp(value, length = 6) {
  const v = String(value ?? "");
  const d = digitsOnly(v);
  if (d.length !== length || d !== v.replace(/\s/g, "")) return fail(MESSAGES.otpLength(length));
  return { valid: true, message: "", normalized: d };
}

export function validateUsername(value, { min = 3, max = 30 } = {}) {
  const v = String(value ?? "").trim();
  if (!v) return fail(MESSAGES.required("username"));
  const re = new RegExp(`^[A-Za-z0-9][A-Za-z0-9._-]{${min - 2},${max - 2}}[A-Za-z0-9]$`);
  if (!re.test(v)) return fail(MESSAGES.usernameInvalid(min, max));
  return { valid: true, message: "", normalized: v.toLowerCase() };
}

export const POSTAL_REGIONS = Object.freeze({
  IN: Object.freeze({ label: "PIN code", pattern: /^[1-9]\d{5}$/ }),
  US: Object.freeze({ label: "ZIP code", pattern: /^\d{5}(-\d{4})?$/ }),
});

export function validatePostalCode(value, regionCode = "IN") {
  const r = POSTAL_REGIONS[regionCode];
  const v = String(value ?? "").trim();
  if (!v) return fail(MESSAGES.required(r.label));
  if (!r.pattern.test(v)) return fail(MESSAGES.postalInvalid(r));
  return { valid: true, message: "", normalized: v };
}

/** Luhn checksum for card numbers. Catches typos; it does not prove the card exists. Never store card numbers. */
export function luhnValid(value) {
  const s = digitsOnly(value);
  if (s.length < 12 || s.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = s.length - 1; i >= 0; i -= 1) {
    let n = Number(s[i]);
    if (double) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

export function validateCardNumber(value) {
  return luhnValid(value)
    ? { valid: true, message: "", normalized: digitsOnly(value) }
    : fail(MESSAGES.cardInvalid());
}

/** One registry, so the UI and the server look validators up by the same names. */
export const VALIDATORS = Object.freeze({
  name: validateName,
  email: validateEmail,
  mobile: validateMobile,
  otp: validateOtp,
  username: validateUsername,
  postalCode: validatePostalCode,
  cardNumber: validateCardNumber,
});

function fail(message) {
  return { valid: false, message, normalized: "" };
}
