import Razorpay from 'razorpay';
import crypto from 'crypto';
import { ENV } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import { PaymentTransaction } from '../models/paymentTransaction.model.js';

let razorpayInstance = null;

/**
 * Returns the configured Razorpay SDK instance or throws if keys are missing.
 */
export function getRazorpayClient() {
  if (!ENV.RAZORPAY_KEY_ID || !ENV.RAZORPAY_KEY_SECRET) {
    throw ApiError.internal(
      'Razorpay keys (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured on the server.'
    );
  }
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: ENV.RAZORPAY_KEY_ID,
      key_secret: ENV.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}

/**
 * Create a Razorpay order in paise.
 */
export async function createRazorpayOrder({ amountPaise, currency = 'INR', receipt, notes = {} }) {
  if (!Number.isInteger(amountPaise) || amountPaise < 100) {
    throw ApiError.badRequest('Razorpay order amount must be at least 100 paise (₹1).');
  }
  const client = getRazorpayClient();
  return client.orders.create({
    amount: amountPaise,
    currency,
    receipt: String(receipt || `rcpt_${Date.now()}`).slice(0, 40),
    notes,
  });
}

/**
 * Constant-time HMAC-SHA256 verification of Razorpay checkout signature.
 */
export function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature || !ENV.RAZORPAY_KEY_SECRET) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', ENV.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(String(signature), 'utf8');
  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * Constant-time HMAC-SHA256 verification of Razorpay webhook payload.
 */
export function verifyWebhookSignature({ rawBody, signature }) {
  if (!rawBody || !signature || !ENV.RAZORPAY_WEBHOOK_SECRET) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', ENV.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(String(signature), 'utf8');
  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * Initiate an automated refund against a captured Razorpay payment.
 */
export async function initiateRazorpayRefund({ paymentId, amountPaise, notes = {} }) {
  if (!paymentId) {
    throw ApiError.badRequest('Razorpay paymentId is required for refund.');
  }
  const client = getRazorpayClient();
  const payload = { notes };
  if (Number.isInteger(amountPaise) && amountPaise > 0) {
    payload.amount = amountPaise;
  }
  return client.payments.refund(paymentId, payload);
}

/**
 * Create a Razorpay Route linked account for a Gym Partner (Super Admin onboarding).
 */
export async function createRazorpayLinkedAccount({ name, email, phone, legalBusinessName, bankDetails = {} }) {
  const client = getRazorpayClient();
  const accountPayload = {
    email,
    phone: String(phone || '').replace(/\s+/g, ''),
    type: 'route',
    legal_business_name: legalBusinessName || name,
    business_type: 'proprietorship',
    contact_name: bankDetails.accountHolder || name,
    profile: {
      category: 'services',
      subcategory: 'health_and_fitness',
    },
  };
  return client.accounts.create(accountPayload);
}

/**
 * Transfer settled funds from a captured Razorpay payment to a Gym Partner linked account.
 */
export async function createRazorpayRouteTransfer({ paymentId, linkedAccountId, amountPaise, notes = {} }) {
  if (!paymentId || !linkedAccountId) {
    throw ApiError.badRequest('paymentId and linkedAccountId are required for Route transfer.');
  }
  if (!Number.isInteger(amountPaise) || amountPaise < 100) {
    throw ApiError.badRequest('Transfer amount must be at least ₹1 (100 paise).');
  }
  const client = getRazorpayClient();
  return client.payments.transfer(paymentId, {
    transfers: [
      {
        account: linkedAccountId,
        amount: amountPaise,
        currency: 'INR',
        notes,
        on_hold: 0,
      },
    ],
  });
}

/**
 * Look up a Razorpay PaymentTransaction by domain referenceId and initiate refund if paid online.
 */
export async function refundPaymentForReference({ referenceId, amountPaise, reason = '', initiatedBy = 'SYSTEM' }) {
  if (!referenceId || !amountPaise || amountPaise <= 0) return null;
  const txn = await PaymentTransaction.findOne({
    referenceId,
    status: { $in: ['PAID', 'PARTIALLY_REFUNDED'] },
  });
  if (!txn || !txn.paymentId || !txn.paymentId.startsWith('pay_')) {
    return null;
  }

  const alreadyRefunded = (txn.refunds || []).reduce((sum, r) => sum + (r.amountPaise || 0), 0);
  const maxRefundable = Math.max(0, txn.amountPaise - alreadyRefunded);
  const finalRefundPaise = Math.min(amountPaise, maxRefundable);
  if (finalRefundPaise < 100) return null;

  const refund = await initiateRazorpayRefund({
    paymentId: txn.paymentId,
    amountPaise: finalRefundPaise,
    notes: { reason: String(reason).slice(0, 200), referenceId: String(referenceId) },
  });

  txn.refunds.push({
    refundId: refund.id,
    amountPaise: finalRefundPaise,
    status: refund.status === 'processed' ? 'PROCESSED' : 'PENDING',
    reason,
    initiatedBy,
  });
  txn.status = alreadyRefunded + finalRefundPaise >= txn.amountPaise ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
  await txn.save();
  return refund;
}
