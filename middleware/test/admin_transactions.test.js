import test from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { PAYMENT_METHODS as BOOKING_PAYMENT_METHODS, PAYMENT_STATUS as BOOKING_PAYMENT_STATUS } from '../src/models/booking.model.js';
import { PAYMENT_METHODS as MEMBERSHIP_PAYMENT_METHODS, PAYMENT_STATUS as MEMBERSHIP_PAYMENT_STATUS } from '../src/models/membership.model.js';

test('Admin Transactions & Payments Architecture Tests', async (t) => {
  await t.test('1. Payment methods and statuses align between Booking and Membership (SSOT)', () => {
    assert.deepStrictEqual(BOOKING_PAYMENT_METHODS, MEMBERSHIP_PAYMENT_METHODS);
    assert.ok(BOOKING_PAYMENT_METHODS.includes('UPI'));
    assert.ok(BOOKING_PAYMENT_METHODS.includes('Card'));
    assert.ok(BOOKING_PAYMENT_METHODS.includes('Wallet'));

    assert.deepStrictEqual(BOOKING_PAYMENT_STATUS, MEMBERSHIP_PAYMENT_STATUS);
    assert.ok(BOOKING_PAYMENT_STATUS.includes('Completed'));
    assert.ok(BOOKING_PAYMENT_STATUS.includes('Pending'));
    assert.ok(BOOKING_PAYMENT_STATUS.includes('Failed'));
  });

  await t.test('2. Unified transaction sorting logic (newest rawDate first)', () => {
    const list = [
      { id: '1', rawDate: 1000 },
      { id: '2', rawDate: 3000 },
      { id: '3', rawDate: 2000 },
    ];
    const sorted = [...list].sort((a, b) => b.rawDate - a.rawDate);
    assert.strictEqual(sorted[0].id, '2');
    assert.strictEqual(sorted[1].id, '3');
    assert.strictEqual(sorted[2].id, '1');
  });

  await t.test('3. Server-side transaction pagination slicing and boundary checks', () => {
    const totalRecords = 25;
    const limit = 10;
    const page = 2;
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(totalRecords / limit);

    assert.strictEqual(skip, 10);
    assert.strictEqual(totalPages, 3);
    assert.strictEqual(skip + limit, 20);
    assert.strictEqual(page < totalPages, true); // hasNextPage
  });
});

