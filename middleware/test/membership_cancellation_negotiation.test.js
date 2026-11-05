import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCancellationQuote } from '../src/services/cancellationNegotiation.service.js';

test('Membership Cancellation Negotiation Logic', async (t) => {
  await t.test('1. Calculates prorated refund quote correctly', () => {
    const membership = {
      startDate: new Date(Date.now() - 10 * 86400000).toISOString(), // 10 days ago
      endDate: new Date(Date.now() + 20 * 86400000).toISOString(),   // 20 days remaining (total 30 days)
      pricing: { totalAmount: 3000 },
    };

    const quote = calculateCancellationQuote(membership);
    assert.equal(quote.originalAmount, 3000);
    // approx 10/30 used = ~1000, max refund = ~2000
    assert.ok(quote.maximumRefundAmount >= 1900 && quote.maximumRefundAmount <= 2100, `Expected refund ~2000, got ${quote.maximumRefundAmount}`);
    assert.ok(quote.daysUsed >= 9 && quote.daysUsed <= 11, `Expected daysUsed ~10, got ${quote.daysUsed}`);
  });

  await t.test('2. Handles fresh membership on day 0 with full refund', () => {
    const now = new Date();
    const membership = {
      startDate: now.toISOString(),
      endDate: new Date(now.getTime() + 30 * 86400000).toISOString(),
      pricing: { totalAmount: 1500 },
    };

    const quote = calculateCancellationQuote(membership, now);
    assert.equal(quote.originalAmount, 1500);
    assert.equal(quote.maximumRefundAmount, 1500);
  });
});
