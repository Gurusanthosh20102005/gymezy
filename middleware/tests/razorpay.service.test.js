import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { ENV } from '../src/config/env.js';
import {
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from '../src/services/razorpay.service.js';

// Set deterministic test secrets for unit testing signature verification
ENV.RAZORPAY_KEY_ID = 'rzp_test_unit_key';
ENV.RAZORPAY_KEY_SECRET = 'rzp_test_unit_secret_12345';
ENV.RAZORPAY_WEBHOOK_SECRET = 'rzp_webhook_unit_secret_67890';

const orderId = 'order_Test123456';
const paymentId = 'pay_Test987654';
const validSignature = crypto
  .createHmac('sha256', ENV.RAZORPAY_KEY_SECRET)
  .update(`${orderId}|${paymentId}`)
  .digest('hex');

assert.equal(
  verifyCheckoutSignature({ orderId, paymentId, signature: validSignature }),
  true,
  'Valid Razorpay checkout signature must verify'
);
assert.equal(
  verifyCheckoutSignature({ orderId: 'order_Tampered', paymentId, signature: validSignature }),
  false,
  'Tampered orderId must fail verification'
);
assert.equal(
  verifyCheckoutSignature({ orderId, paymentId, signature: 'bad_sig' }),
  false,
  'Invalid signature must fail verification'
);

const rawWebhookBody = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: paymentId, order_id: orderId } } } }));
const validWebhookSig = crypto
  .createHmac('sha256', ENV.RAZORPAY_WEBHOOK_SECRET)
  .update(rawWebhookBody)
  .digest('hex');

assert.equal(
  verifyWebhookSignature({ rawBody: rawWebhookBody, signature: validWebhookSig }),
  true,
  'Valid webhook raw-body signature must verify'
);
assert.equal(
  verifyWebhookSignature({ rawBody: rawWebhookBody, signature: 'tampered_sig' }),
  false,
  'Tampered webhook signature must fail verification'
);

console.log('All Razorpay HMAC signature & webhook unit tests passed.');
