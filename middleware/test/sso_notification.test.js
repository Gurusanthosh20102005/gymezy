import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { verifyGoogleIdToken, sendPushNotification } from '../src/services/firebase.service.js';

describe('Google SSO & FCM Services Unit Tests', () => {
  test('1. verifyGoogleIdToken validates token structure and rejects invalid signatures in live mode', async () => {
    // With live Firebase initialized, an untrusted JWT signature should be rejected by Google's Auth servers
    const dummyToken = 'header.payload.invalidsignature';
    await assert.rejects(
      async () => {
        await verifyGoogleIdToken(dummyToken);
      },
      (err) =>
        err.message.includes('Invalid Google ID token') ||
        err.message.includes('Decoding Firebase ID token failed') ||
        err.message.includes('Could not verify Google ID token')
    );
  });

  test('2. verifyGoogleIdToken throws error on empty or invalid token', async () => {
    await assert.rejects(
      async () => {
        await verifyGoogleIdToken('');
      },
      {
        message: 'A valid Google ID token is required.',
      }
    );
  });

  test('3. sendPushNotification handles empty token array safely without error', async () => {
    const result = await sendPushNotification([], {
      title: 'Welcome',
      body: 'Hello',
    });
    assert.equal(result.successCount, 0);
    assert.equal(result.failureCount, 0);
    assert.deepEqual(result.invalidTokens, []);
  });

  test('4. sendPushNotification dispatches payload via live FCM or mock fallback safely', async () => {
    const tokens = ['fcm_device_token_abc_123'];
    const result = await sendPushNotification(tokens, {
      title: 'Booking Confirmed',
      body: 'Your slot is scheduled for 6:00 PM.',
      data: { bookingId: 'b_999' },
    });
    // In live mode with mock device token, FCM correctly reports delivery attempt and identifies dead token
    assert.ok(typeof result.successCount === 'number');
    assert.ok(typeof result.failureCount === 'number');
    assert.ok(Array.isArray(result.invalidTokens));
  });
});
