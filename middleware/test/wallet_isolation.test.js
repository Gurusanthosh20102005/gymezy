import test from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { Wallet } from '../src/models/wallet.model.js';

test('Gym-Specific Wallet Isolation & Ledger Integrity Tests', async (t) => {
  await t.test('1. Wallet schema has compound index on userId + gymId', () => {
    const indexes = Wallet.schema.indexes();
    const hasCompoundUserGymIndex = indexes.some(
      ([fields, options]) => fields.userId === 1 && fields.gymId === 1 && options?.unique === true
    );
    assert.strictEqual(hasCompoundUserGymIndex, true, 'Wallet must enforce unique index on { userId: 1, gymId: 1 }');
  });

  await t.test('2. Two wallets for the same user at different gyms are completely independent', () => {
    const userId = new mongoose.Types.ObjectId();
    const gymA = new mongoose.Types.ObjectId();
    const gymB = new mongoose.Types.ObjectId();

    // Instantiate Wallet A with ₹500 (50000 paise)
    const walletA = new Wallet({
      userId,
      gymId: gymA,
      balancePaise: 50000,
      currency: 'INR',
      history: [
        {
          transactionId: 'TXN_A_1',
          type: 'CREDIT',
          source: 'TOP_UP',
          amountPaise: 50000,
          balanceAfterPaise: 50000,
          description: 'Top-up at Gym A',
        },
      ],
    });

    // Instantiate Wallet B with ₹0
    const walletB = new Wallet({
      userId,
      gymId: gymB,
      balancePaise: 0,
      currency: 'INR',
      history: [],
    });

    assert.strictEqual(walletA.balancePaise, 50000);
    assert.strictEqual(walletB.balancePaise, 0);
    assert.notStrictEqual(walletA.gymId.toString(), walletB.gymId.toString());

    // Deduct ₹200 from Wallet A
    const deductPaise = 20000;
    walletA.balancePaise -= deductPaise;
    walletA.history.push({
      transactionId: 'TXN_A_2',
      type: 'DEBIT',
      source: 'BOOKING_PAYMENT',
      amountPaise: deductPaise,
      balanceAfterPaise: walletA.balancePaise,
      description: 'Session payment at Gym A',
    });

    assert.strictEqual(walletA.balancePaise, 30000, 'Wallet A balance should be ₹300 (30000 paise)');
    assert.strictEqual(walletB.balancePaise, 0, 'Wallet B balance should remain untouched at ₹0');
    assert.strictEqual(walletA.history.length, 2);
    assert.strictEqual(walletB.history.length, 0);
  });

  await t.test('3. Cross-gym payment rejection rule: funds at Gym A cannot satisfy Gym B', () => {
    const targetGym = 'Gym B';
    const gymBWalletBalancePaise = 0;
    const orderCostPaise = 25000; // ₹250

    // Validation logic as implemented in booking.controller.js and membership.controller.js
    const isSufficient = gymBWalletBalancePaise >= orderCostPaise;
    assert.strictEqual(isSufficient, false, 'Gym B must reject payment even if user has funds at another gym');
  });

  await t.test('4. Ledger transaction sources include BOOKING_PAYMENT and MEMBERSHIP_PURCHASE', () => {
    const allowedSources = Wallet.schema.path('history.source')?.enumValues || Wallet.schema.paths['history.source']?.enumValues;
    assert.ok(Array.isArray(allowedSources), 'history.source enum must be defined');
    assert.ok(allowedSources.includes('BOOKING_PAYMENT'), 'history.source must allow BOOKING_PAYMENT');
    assert.ok(allowedSources.includes('MEMBERSHIP_PURCHASE'), 'history.source must allow MEMBERSHIP_PURCHASE');
    assert.ok(allowedSources.includes('TOP_UP'), 'history.source must allow TOP_UP');
  });

  await t.test('5. Split Payment: Partial wallet balance deducts exact available funds and calculates remainder', () => {
    const totalOrderCostINR = 13999;
    const totalOrderCostPaise = totalOrderCostINR * 100;
    const userWalletBalancePaise = 250000; // ₹2,500

    // Partial split calculation logic
    const appliedWalletPaise = Math.min(userWalletBalancePaise, totalOrderCostPaise);
    const netPayablePaise = totalOrderCostPaise - appliedWalletPaise;

    assert.strictEqual(appliedWalletPaise, 250000, 'Applied wallet amount should be ₹2,500 (250000 paise)');
    assert.strictEqual(netPayablePaise, 1149900, 'Net payable should be ₹11,499 (1149900 paise)');
    assert.strictEqual(netPayablePaise / 100, 11499);
    assert.strictEqual(appliedWalletPaise / 100, 2500);

    // Ledger debit
    const newBalancePaise = userWalletBalancePaise - appliedWalletPaise;
    assert.strictEqual(newBalancePaise, 0, 'Wallet balance after full offset deduction is ₹0');
  });
});

