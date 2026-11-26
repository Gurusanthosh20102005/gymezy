#!/usr/bin/env node
// Self-test for assets/validation-core.mjs. Run: node scripts/selftest.mjs
// Re-run it after changing any rule or policy value. Exits 1 on any failure.
import { readFileSync } from "node:fs";
import * as V from "../assets/validation-core.mjs";

let passed = 0;
const failures = [];
function t(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed += 1; else failures.push(`${name}\n     expected ${JSON.stringify(expected)}\n     got      ${JSON.stringify(actual)}`);
}
const pw = (v, policy, ctx) => V.checkPassword(v, policy, ctx);
const failedIds = (v, policy, ctx) => pw(v, policy, ctx).rules.filter((r) => !r.passed).map((r) => r.id);

// ---------------------------------------------------------------- password: the 8-16 policy
t("valid minimum (8)", pw("Abcdef1!").valid, true);
t("valid maximum (16)", pw("Abcdefghijklm1!x").valid, true);
t("7 characters is too short", failedIds("Abcde1!"), ["length"]);
t("7 characters message", pw("Abcde1!").message, "Use at least 8 characters");
t("17 characters is too long", failedIds("Abcdefghijklmn1!x"), ["length"]);
t("17 characters message", pw("Abcdefghijklmn1!x").message, "Use at most 16 characters");
t("missing uppercase", failedIds("abcdefg1!"), ["uppercase"]);
t("missing lowercase", failedIds("ABCDEFG1!"), ["lowercase"]);
t("missing number", failedIds("Abcdefgh!"), ["number"]);
t("missing symbol", failedIds("Abcdefg12"), ["symbol"]);
t("a leading space is rejected, never trimmed", failedIds(" Abcdef1!"), ["no-space"]);
t("space inside", failedIds("Abcd ef1!"), ["no-space"]);
t("accented letter is outside the charset", failedIds("Abcdéfg1!"), ["charset"]);
t("emoji fails the charset", failedIds("Abcdefg1!\u{1F600}"), ["charset"]);
t("emoji does not inflate the length", pw("Abcdefg1!\u{1F600}").rules[0].passed, true);
t("complex but common is blocked", failedIds("Password@123"), ["not-common"]);
t("empty password lists failing rules, never throws", pw("").valid, false);
t("empty password message", pw("").message, "Enter a password");
t("null/undefined are safe", [pw(null).valid, pw(undefined).valid], [false, false]);
for (const ch of V.PASSWORD_POLICY.symbols) {
  t(`symbol accepted: ${ch}`, pw(`Abcdefg1${ch}`).rules.find((r) => r.id === "symbol").passed, true);
}
t("identifier: email name inside password", failedIds("Priya@2024!", undefined, { email: "priya.raman@example.com" }), ["not-identifier"]);
t("identifier: first name token", failedIds("Raman#2024a", undefined, { name: "Priya Raman" }), ["not-identifier"]);
t("identifier: last six phone digits", failedIds("A#543210b", undefined, { mobile: "98765 43210" }), ["not-identifier"]);
t("identifier: short name tokens ignored", failedIds("Abcdef1!", undefined, { name: "Al Bo" }), []);
t("policy override: 12 to 64, no symbol", pw("Abcdefghij12", { minLength: 12, maxLength: 64, requireSymbol: false }).valid, true);
t("policy override keeps other defaults", failedIds("abcdefghij12", { minLength: 12, maxLength: 64, requireSymbol: false }), ["uppercase"]);
t("default policy object is frozen", Object.isFrozen(V.PASSWORD_POLICY), true);
t("confirm: match", V.validatePasswordConfirm("Abcdef1!", "Abcdef1!").valid, true);
t("confirm: mismatch", V.validatePasswordConfirm("Abcdef1!", "Abcdef1?").valid, false);
t("confirm: empty", V.validatePasswordConfirm("", "").valid, false);
t("confirm: no trimming", V.validatePasswordConfirm("Abcdef1!", "Abcdef1! ").valid, false);
t("hard flag: too long is hard", pw("Abcdefghijklmn1!x").rules[0].hard, true);
t("hard flag: too short is soft (more typing fixes it)", pw("Abc1!").rules[0].hard, false);
t("hard flag: missing uppercase is soft", pw("abcdefg1!").rules.find((r) => r.id === "uppercase").hard, false);
t("hard flag: a space is hard", pw("Abcd ef1!").rules.find((r) => r.id === "no-space").hard, true);
t("hard flag: passing rules are never hard", pw("Abcdef1!").rules.some((r) => r.hard), false);
t("quiet flag: negative rules are quiet", pw("Abcdef1!").rules.filter((r) => r.quiet).map((r) => r.id).sort(), ["charset", "no-space", "not-common", "not-identifier"]);
t("quiet flag: positive rules are not quiet", pw("Abcdef1!").rules.filter((r) => !r.quiet).map((r) => r.id), ["length", "uppercase", "lowercase", "number", "symbol"]);

// ---------------------------------------------------------------- the "modern" preset documented in references/password-policy.md
const MODERN = { minLength: 12, maxLength: 128, requireUppercase: false, requireLowercase: false, requireNumber: false, requireSymbol: false,
  allowWhitespace: true, asciiOnly: false, blockCommon: true, blockIdentifiers: true };
t("modern preset: a long passphrase with spaces is valid", pw("correct horse battery staple", MODERN).valid, true);
t("modern preset: accented letters and emoji are allowed", pw("Zoë likes café 🍵 a lot", MODERN).valid, true);
t("modern preset: 11 characters is too short", pw("elevenchars", MODERN).valid, false);
t("modern preset: a common password is still blocked", failedIds("Password@123", MODERN), ["not-common"]);
t("modern preset: no composition rules are checked", pw("alllowercasebutlong", MODERN).rules.map((r) => r.id), ["length", "not-common", "not-identifier"]);

// ---------------------------------------------------------------- mobile (IN, US)
const m = (v, r) => V.validateMobile(v, r);
t("IN plain", m("9876543210").normalized, "+919876543210");
t("IN with space", m("98765 43210").valid, true);
t("IN with dash", m("98765-43210").valid, true);
t("IN pasted +91", m("+91 98765 43210").normalized, "+919876543210");
t("IN pasted 91 prefix", m("919876543210").normalized, "+919876543210");
t("IN pasted trunk 0", m("09876543210").normalized, "+919876543210");
t("IN pasted 0091", m("0091 9876543210").normalized, "+919876543210");
t("IN brackets", m("(98765) 43210").valid, true);
t("IN full-width digits", m("９８７６５４３２１０").valid, true);
t("IN starts with 5 is invalid", m("5876543210").valid, false);
t("IN too short message", m("98765").message, "Enter a 10-digit mobile number");
t("IN too long", m("98765432101").valid, false);
t("IN empty", m("").message, "Enter your mobile number");
t("IN letters are REJECTED, not stripped", m("98765abc43210").valid, false);
t("IN only letters", m("abcdefghij").valid, false);
t("IN script injection", m("9876543210<script>").valid, false);
t("IN number can start with 91 when typed", V.sanitizeMobile("9198765432", "IN"), "9198765432");
t("IN typing an 11th digit never rewrites the number", V.sanitizeMobile("91987654321", "IN"), "9198765432");
t("IN paste strips +91", V.sanitizeMobile("+91 98765 43210", "IN", { pasted: true }), "9876543210");
t("IN paste of a plain 12-digit non-91 number is only capped", V.sanitizeMobile("987654321012", "IN", { pasted: true }), "9876543210");
t("sanitize with cap:false keeps counting past the cap (the helper needs this)", V.sanitizeMobile("98765432101", "IN", { cap: false }), "98765432101");
t("sanitize drops letters while typing", V.sanitizeMobile("98a76b", "IN"), "9876");
t("sanitize full-width digits", V.sanitizeMobile("９８", "IN"), "98");
t("US valid", m("(415) 555-2671", "US").normalized, "+14155552671");
t("US exchange cannot start with 1", m("415 155 2671", "US").valid, false);
t("US paste with +1", m("+1 415 555 2671", "US").normalized, "+14155552671");
t("E.164 valid", V.isE164("+919876543210"), true);
t("E.164 missing plus", V.isE164("919876543210"), false);
t("E.164 leading zero country", V.isE164("+0123456"), false);
t("E.164 too long", V.isE164("+1234567890123456"), false);

// ---------------------------------------------------------------- email
const e = (v) => V.validateEmail(v);
t("email ok", e("name@company.com").valid, true);
t("email plus tag + subdomain", e("first.last+tag@sub.example.co.in").valid, true);
t("email normalized to lower case and trimmed", e("  Name@Company.COM ").normalized, "name@company.com");
t("email needs a dot in the domain", e("name@company").valid, false);
t("email double @", e("name@@company.com").valid, false);
t("email double dot in domain", e("name@company..com").valid, false);
t("email leading dot in local part", e(".name@company.com").valid, false);
t("email dot before @", e("name.@company.com").valid, false);
t("email space", e("na me@company.com").valid, false);
t("email empty", e("").message, "Enter your email address");
t("email too long", e(`${"a".repeat(250)}@b.co`).valid, false);
t("email local part over 64", e(`${"a".repeat(65)}@company.com`).valid, false);
t("email message", e("nope").message, "Enter an email address like name@company.com");

// ---------------------------------------------------------------- names
const n = (v) => V.validateName(v);
for (const good of ["Priya Raman", "O'Brien", "Anne-Marie", "Jean-Luc Picard", "李小龍", "Zoë", "José", "Zoe\u0308", "D’Angelo", "Dr. J. Smith", "X"]) {
  t(`name accepted: ${good}`, n(good).valid, true);
}
for (const bad of ["R2D2", "Priya_Raman", "", "   ", "<b>x</b>", "9Lives"]) t(`name rejected: ${JSON.stringify(bad)}`, n(bad).valid, false);
t("name collapses spaces and trims", n("  Priya   Raman ").normalized, "Priya Raman");
t("name too long", n("a".repeat(101)).valid, false);

// ---------------------------------------------------------------- otp, username, postal, card
t("otp ok", V.validateOtp("123456").normalized, "123456");
t("otp with a pasted space", V.validateOtp("123 456").valid, true);
t("otp too short", V.validateOtp("12345").valid, false);
t("otp letters", V.validateOtp("12a456").valid, false);
t("otp 4 digits", V.validateOtp("1234", 4).valid, true);
t("username ok", V.validateUsername("priya_raman").valid, true);
t("username lowercased", V.validateUsername("Priya.Raman").normalized, "priya.raman");
t("username too short", V.validateUsername("ab").valid, false);
t("username 3 chars ok", V.validateUsername("abc").valid, true);
t("username ends with symbol", V.validateUsername("abc-").valid, false);
t("username starts with underscore", V.validateUsername("_abc").valid, false);
t("username 30 ok", V.validateUsername("a".repeat(30)).valid, true);
t("username 31 too long", V.validateUsername("a".repeat(31)).valid, false);
t("PIN ok", V.validatePostalCode("110001", "IN").valid, true);
t("PIN cannot start with 0", V.validatePostalCode("012345", "IN").valid, false);
t("PIN 5 digits", V.validatePostalCode("11000", "IN").valid, false);
t("ZIP ok", V.validatePostalCode("94105", "US").valid, true);
t("ZIP+4 ok", V.validatePostalCode("94105-1234", "US").valid, true);
t("ZIP 4 digits", V.validatePostalCode("9410", "US").valid, false);
t("Luhn visa test number", V.luhnValid("4111 1111 1111 1111"), true);
t("Luhn mastercard test number", V.luhnValid("5500 0000 0000 0004"), true);
t("Luhn amex test number", V.luhnValid("3782 822463 10005"), true);
t("Luhn one digit off", V.luhnValid("4111 1111 1111 1112"), false);
t("Luhn too short", V.luhnValid("79927398713"), false);
t("registry exposes every validator", Object.keys(V.VALIDATORS).sort(), ["cardNumber", "email", "mobile", "name", "otp", "postalCode", "username"]);

// ---------------------------------------------------------------- shared test vectors (the same file other languages run)
const vectors = JSON.parse(readFileSync(new URL("../assets/test-vectors.json", import.meta.url), "utf8"));
for (const c of vectors.password.cases) {
  const r = V.checkPassword(c.value, vectors.password.policy);
  t(`vector password ${JSON.stringify(c.value)}`, r.valid, c.valid);
  if (c.failed) t(`vector password ${JSON.stringify(c.value)} failed rules`, r.rules.filter((x) => !x.passed).map((x) => x.id).filter((id) => c.failed.includes(id)).sort(), [...c.failed].sort());
}
for (const [group, fn] of [["mobile_IN", (v) => V.validateMobile(v, "IN")], ["email", V.validateEmail], ["name", (v) => V.validateName(v)]]) {
  for (const c of vectors[group].cases) {
    const r = fn(c.input);
    t(`vector ${group} ${JSON.stringify(c.input)}`, r.valid, c.valid);
    if (c.normalized !== undefined) t(`vector ${group} ${JSON.stringify(c.input)} normalized`, r.normalized, c.normalized);
  }
}

// ---------------------------------------------------------------- performance guard (ReDoS / long input)
const big = "a".repeat(200000) + "@" + "b".repeat(200000);
const t0 = performance.now();
V.validateEmail(big); V.validateName("a".repeat(200000)); V.checkPassword("A1!".repeat(100000)); V.validateMobile("9".repeat(200000));
t("pathological long inputs finish quickly (under 1 second)", performance.now() - t0 < 1000, true);

console.log(`${passed} checks passed, ${failures.length} failed`);
if (failures.length) { console.log("\n" + failures.join("\n")); process.exit(1); }
