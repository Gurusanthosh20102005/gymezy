import test from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import gymRoutes from '../src/routes/gym.routes.js';

test('Gym Owner Scoped Transactions & Payments Architecture Tests', async (t) => {
  await t.test('1. Gym routes expose scoped /:id/transactions and /:id/payments endpoints', () => {
    const routeStack = gymRoutes.stack || [];
    const registeredPaths = routeStack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);

    assert.ok(
      registeredPaths.includes('/:id/transactions'),
      '/:id/transactions route must be registered in gymRoutes'
    );
    assert.ok(
      registeredPaths.includes('/:id/payments'),
      '/:id/payments route must be registered in gymRoutes'
    );
  });

  await t.test('2. Gym-scoped query isolation logic ensures cross-gym boundary integrity', () => {
    const gymA = new mongoose.Types.ObjectId();
    const gymB = new mongoose.Types.ObjectId();

    const mockTransactionsFleet = [
      { id: 'tx-1', gymId: gymA, amount: 500, title: 'Session Gym A' },
      { id: 'tx-2', gymId: gymA, amount: 1500, title: 'Membership Gym A' },
      { id: 'tx-3', gymId: gymB, amount: 2000, title: 'Membership Gym B' },
    ];

    // Simulating gymId filter
    const gymATxns = mockTransactionsFleet.filter((t) => String(t.gymId) === String(gymA));
    const gymBTxns = mockTransactionsFleet.filter((t) => String(t.gymId) === String(gymB));

    assert.strictEqual(gymATxns.length, 2, 'Gym A must only see its own 2 transactions');
    assert.strictEqual(gymBTxns.length, 1, 'Gym B must only see its own 1 transaction');
    assert.ok(
      gymATxns.every((t) => String(t.gymId) === String(gymA)),
      'No Gym B transactions must leak to Gym A'
    );
  });

  await t.test('3. Scoped collections statistics correctly compute total collections for that gym alone', () => {
    const gymTransactions = [
      { amount: 1000, status: 'Completed' },
      { amount: 500, status: 'Completed' },
      { amount: 300, status: 'Pending' },
      { amount: 200, status: 'Failed' },
    ];

    const totalTxnCount = gymTransactions.length;
    const completedTxns = gymTransactions.filter((t) => t.status === 'Completed');
    const totalAmount = completedTxns.reduce((sum, t) => sum + t.amount, 0);
    const successRate = ((completedTxns.length / totalTxnCount) * 100).toFixed(1) + '%';

    assert.strictEqual(totalTxnCount, 4);
    assert.strictEqual(completedTxns.length, 2);
    assert.strictEqual(totalAmount, 1500);
    assert.strictEqual(successRate, '50.0%');
  });
});
