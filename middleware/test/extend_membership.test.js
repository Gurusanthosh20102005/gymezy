import test from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { Membership } from '../src/models/membership.model.js';
import { extendWalkInMembership, sendAppRenewalOffer } from '../src/controllers/membership.controller.js';

function createMockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('Extend Membership Dual-Lifecycle Controller Tests', async (t) => {
  const originalFindOne = Membership.findOne;
  const originalFindById = Membership.findById;

  t.afterEach(() => {
    Membership.findOne = originalFindOne;
    Membership.findById = originalFindById;
  });

  await t.test('1. Blocks extension on Cancelled memberships (WALK_IN)', async () => {
    Membership.findOne = async () => ({
      _id: new mongoose.Types.ObjectId(),
      membershipId: 'MEM-CANCEL-1',
      source: 'WALK_IN',
      status: 'Cancelled',
    });

    const req = { params: { id: 'MEM-CANCEL-1' }, body: { planTier: 'Monthly' }, user: {} };
    const res = createMockRes();
    let capturedErr = null;

    await extendWalkInMembership(req, res, (err) => {
      capturedErr = err;
    });

    assert.ok(capturedErr, 'Expected ApiError for Cancelled membership');
    assert.strictEqual(capturedErr.statusCode, 400);
    assert.match(capturedErr.message, /Cancelled memberships cannot be extended/i);
  });

  await t.test('2. Blocks direct desk extension on APP memberships', async () => {
    Membership.findOne = async () => ({
      _id: new mongoose.Types.ObjectId(),
      membershipId: 'MEM-APP-1',
      source: 'APP',
      walkInDetails: { bookedBy: null, bookedByName: '' },
      status: 'Active',
    });

    const req = { params: { id: 'MEM-APP-1' }, body: { planTier: 'Monthly' }, user: {} };
    const res = createMockRes();
    let capturedErr = null;

    await extendWalkInMembership(req, res, (err) => {
      capturedErr = err;
    });

    assert.ok(capturedErr, 'Expected ApiError when calling direct extend on APP membership');
    assert.strictEqual(capturedErr.statusCode, 400);
    assert.match(capturedErr.message, /Online App memberships cannot be billed directly/i);
  });

  await t.test('3. Stacks durationDays onto future endDate for Active WALK_IN membership', async () => {
    const id = new mongoose.Types.ObjectId();
    const futureEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // +10 days
    const doc = {
      _id: id,
      membershipId: 'MEM-WALKIN-ACTIVE',
      source: 'WALK_IN',
      status: 'Active',
      membershipTier: 'Monthly',
      durationDays: 30,
      endDate: futureEnd,
      pricing: { totalAmount: 1500, trainerFee: 0 },
      payment: { method: 'Cash' },
      extensionHistory: [],
      saveCalled: false,
      async save() {
        this.saveCalled = true;
        return this;
      },
    };

    Membership.findOne = async () => doc;
    Membership.findById = () => ({
      populate() {
        return this;
      },
      async lean() {
        return { ...doc };
      },
    });

    const req = {
      params: { id: 'MEM-WALKIN-ACTIVE' },
      body: { planTier: 'Monthly', durationDays: 30, amountPaid: 1500, paymentMethod: 'UPI' },
      user: { fullName: 'Owner Test' },
    };
    const res = createMockRes();
    let capturedErr = null;

    await extendWalkInMembership(req, res, (err) => {
      capturedErr = err;
    });

    assert.strictEqual(capturedErr, null);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(doc.saveCalled, true);

    const expectedEndMs = futureEnd.getTime() + 30 * 24 * 60 * 60 * 1000;
    assert.ok(Math.abs(doc.endDate.getTime() - expectedEndMs) < 1000, 'Must stack 30 days onto existing future endDate');
    assert.strictEqual(doc.durationDays, 60);
    assert.strictEqual(doc.pricing.totalAmount, 3000);
    assert.strictEqual(doc.payment.method, 'UPI');
    assert.strictEqual(doc.extensionHistory.length, 1);
    assert.strictEqual(doc.extensionHistory[0].addedDays, 30);
    assert.strictEqual(doc.extensionHistory[0].extendedByName, 'Owner Test');
  });

  await t.test('4. Stacks durationDays from now for Expired WALK_IN membership', async () => {
    const id = new mongoose.Types.ObjectId();
    const pastEnd = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000); // 20 days ago
    const beforeCall = Date.now();
    const doc = {
      _id: id,
      membershipId: 'MEM-WALKIN-EXPIRED',
      source: 'WALK_IN',
      status: 'Expired',
      membershipTier: 'Monthly',
      durationDays: 30,
      endDate: pastEnd,
      pricing: { totalAmount: 1500, trainerFee: 0 },
      payment: { method: 'Cash' },
      extensionHistory: [],
      async save() {
        return this;
      },
    };

    Membership.findOne = async () => doc;
    Membership.findById = () => ({
      populate() {
        return this;
      },
      async lean() {
        return { ...doc };
      },
    });

    const req = {
      params: { id: 'MEM-WALKIN-EXPIRED' },
      body: { planTier: 'Quarterly', durationDays: 90, amountPaid: 4000, paymentMethod: 'Card' },
      user: { name: 'Front Desk' },
    };
    const res = createMockRes();
    let capturedErr = null;

    await extendWalkInMembership(req, res, (err) => {
      capturedErr = err;
    });

    assert.strictEqual(capturedErr, null);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(doc.status, 'Active');
    const minExpectedEnd = beforeCall + 90 * 24 * 60 * 60 * 1000 - 1000;
    assert.ok(doc.endDate.getTime() >= minExpectedEnd, 'Expired membership must extend from current date, not past endDate');
    assert.strictEqual(doc.membershipTier, 'Quarterly');
  });

  await t.test('5. Blocks sendAppRenewalOffer on WALK_IN memberships', async () => {
    Membership.findOne = async () => ({
      _id: new mongoose.Types.ObjectId(),
      membershipId: 'MEM-WALKIN-2',
      source: 'WALK_IN',
      status: 'Active',
    });

    const req = { params: { id: 'MEM-WALKIN-2' }, body: { planTier: 'Monthly', amount: 1500 }, user: {} };
    const res = createMockRes();
    let capturedErr = null;

    await sendAppRenewalOffer(req, res, (err) => {
      capturedErr = err;
    });

    assert.ok(capturedErr);
    assert.strictEqual(capturedErr.statusCode, 400);
    assert.match(capturedErr.message, /Walk-in memberships should be extended directly/i);
  });

  await t.test('6. Blocks sendAppRenewalOffer on Cancelled memberships', async () => {
    Membership.findOne = async () => ({
      _id: new mongoose.Types.ObjectId(),
      membershipId: 'MEM-APP-CANCEL',
      source: 'APP',
      status: 'Cancelled',
    });

    const req = { params: { id: 'MEM-APP-CANCEL' }, body: { planTier: 'Monthly', amount: 1500 }, user: {} };
    const res = createMockRes();
    let capturedErr = null;

    await sendAppRenewalOffer(req, res, (err) => {
      capturedErr = err;
    });

    assert.ok(capturedErr);
    assert.strictEqual(capturedErr.statusCode, 400);
    assert.match(capturedErr.message, /Cancelled memberships cannot be extended/i);
  });

  await t.test('7. Creates pendingRenewalOffer without mutating endDate or totalAmount for APP membership', async () => {
    const originalEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      membershipId: 'MEM-APP-ACTIVE',
      source: 'APP',
      walkInDetails: { bookedBy: null, bookedByName: '' },
      status: 'Active',
      membershipTier: 'Monthly',
      durationDays: 30,
      endDate: originalEnd,
      pricing: { totalAmount: 2000, trainerFee: 0 },
      pendingRenewalOffer: null,
      saveCalled: false,
      async save() {
        this.saveCalled = true;
        return this;
      },
    };

    Membership.findOne = async () => doc;

    const req = {
      params: { id: 'MEM-APP-ACTIVE' },
      body: { planTier: 'Quarterly', durationDays: 90, amount: 5000, notes: 'Special renewal discount' },
      user: { fullName: 'Gym Owner' },
    };
    const res = createMockRes();
    let capturedErr = null;

    await sendAppRenewalOffer(req, res, (err) => {
      capturedErr = err;
    });

    assert.strictEqual(capturedErr, null);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(doc.saveCalled, true);
    assert.strictEqual(doc.endDate.getTime(), originalEnd.getTime(), 'Must NOT mutate endDate before user pays');
    assert.strictEqual(doc.pricing.totalAmount, 2000, 'Must NOT mutate totalAmount before user pays');
    assert.strictEqual(doc.pendingRenewalOffer.status, 'PENDING');
    assert.strictEqual(doc.pendingRenewalOffer.planTier, 'Quarterly');
    assert.strictEqual(doc.pendingRenewalOffer.addedDays, 90);
    assert.strictEqual(doc.pendingRenewalOffer.amount, 5000);
    assert.strictEqual(doc.pendingRenewalOffer.notes, 'Special renewal discount');
  });
});
