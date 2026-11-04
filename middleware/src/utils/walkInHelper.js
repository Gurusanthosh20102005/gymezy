import crypto from 'node:crypto';
import User, { USER_ROLES } from '../models/user.model.js';

/**
 * Find or create a User account for a Walk-in Customer by Phone Number (SSOT)
 */
export async function findOrCreateWalkInCustomer({ fullName, phone, email }) {
  const cleanPhone = String(phone || '').replace(/[^\d+]/g, '').trim();
  const digitsOnly = cleanPhone.replace(/[^\d]/g, '');
  const last10Digits = digitsOnly.slice(-10);

  if (!last10Digits && !email) {
    throw new Error('A valid customer phone number or email is required for walk-in registration.');
  }

  // Look for existing user by phone or email
  let user = await User.findOne({
    $or: [
      { phone: cleanPhone },
      ...(last10Digits ? [{ phone: { $regex: `${last10Digits}$` } }] : []),
      ...(email ? [{ email: email.trim().toLowerCase() }] : []),
    ],
  });

  if (!user) {
    const fallbackEmail = email && email.trim()
      ? email.trim().toLowerCase()
      : `walkin.${last10Digits || Date.now()}@gymezy.com`;
    const randomPassword = crypto.randomBytes(8).toString('hex') + 'A1!';

    user = await User.create({
      fullName: fullName && fullName.trim() ? fullName.trim() : 'Walk-in Member',
      phone: cleanPhone || last10Digits,
      email: fallbackEmail,
      password: randomPassword,
      role: USER_ROLES.CUSTOMER,
      isVerified: true,
    });
  } else if (fullName && fullName.trim() && (!user.fullName || user.fullName === 'Walk-in Member')) {
    user.fullName = fullName.trim();
    await user.save();
  }

  return user;
}

