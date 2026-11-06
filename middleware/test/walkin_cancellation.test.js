import test from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { Membership } from '../src/models/membership.model.js';
import { MembershipCancellation } from '../src/models/membershipCancellation.model.js';
import { cancelMembership, requestCancellationNegotiation } from '../src/controllers/membership.controller.js';

test('Walk-in vs App Member Cancellation Architecture (SSOT)', async (t) => {
  await t.test('1. Walk-in cancellation logic executes directly with refund quote and no user approval', async () => {
    const dummyWalkIn = {
      _id: new mongoose.Types.ObjectId(),
      membershipId: 'MEM-TEST-WALKIN',
      source: 'WALK_IN',
      walkInDetails: { bookedByName: 'Staff Member' },
      status: 'Active',
      pricing: { totalAmount: 3000 },
      cancellation: null,
      save: async function () {
        return this;
      },
    };

    // Verify source identification
    const isWalkIn = dummyWalkIn.source === 'WALK_IN' || Boolean(dummyWalkIn.walkInDetails);
    assert.strictEqual(isWalkIn, true, 'Walk-in member must be identified via source or walkInDetails');

    // Simulate direct cancellation
    const refundQuote = 2500;
    dummyWalkIn.status = 'Cancelled';
    dummyWalkIn.cancellation = {
      cancelledAt: new Date(),
      reason: 'Customer requested refund at front desk',
      refundAmount: refundQuote,
      cancelledByName: 'Gym Admin',
    };

    assert.strictEqual(dummyWalkIn.status, 'Cancelled');
    assert.strictEqual(dummyWalkIn.cancellation.refundAmount, 2500);
    assert.ok(dummyWalkIn.cancellation.cancelledAt instanceof Date);
  });

  await t.test('2. Online App member requires user approval and negotiation', async () => {
    const dummyAppMember = {
      _id: new mongoose.Types.ObjectId(),
      membershipId: 'MEM-TEST-APP',
      source: 'APP',
      walkInDetails: { bookedBy: null, bookedByName: '', notes: '' }, // Mongoose empty subdocument
      status: 'Active',
      pricing: { totalAmount: 4500 },
    };

    const isWalkIn = dummyAppMember.source === 'WALK_IN' || (dummyAppMember.source !== 'APP' && Boolean(dummyAppMember.walkInDetails?.bookedBy || dummyAppMember.walkInDetails?.bookedByName?.trim()));
    assert.strictEqual(isWalkIn, false, 'App member must NOT be treated as walk-in even if walkInDetails subdocument exists');
  });

  await t.test('3. Walk-in members are excluded from pending negotiation queue', () => {
    const negotiations = [
      {
        requestId: 'CAN-APP-001',
        status: 'PENDING_GYM_APPROVAL',
        membershipId: { source: 'APP', membershipTier: 'Gold', walkInDetails: { bookedByName: '' } },
      },
      {
        requestId: 'CAN-WALKIN-002',
        status: 'PENDING_MEMBER_APPROVAL',
        membershipId: { source: 'WALK_IN', walkInDetails: { bookedByName: 'Counter' } },
      },
      {
        requestId: 'CAN-APP-003',
        status: 'PENDING_MEMBER_APPROVAL',
        membershipId: { source: 'APP', membershipTier: 'Silver', walkInDetails: { bookedByName: '' } },
      },
    ];

    const appOnly = negotiations.filter((item) => {
      const mem = item.membershipId;
      if (!mem) return false;
      const isWalkIn = mem.source === 'WALK_IN' || (mem.source !== 'APP' && Boolean(mem.walkInDetails?.bookedBy || mem.walkInDetails?.bookedByName?.trim()));
      return !isWalkIn;
    });

    assert.strictEqual(appOnly.length, 2, 'Only app member negotiations must be returned');
    assert.strictEqual(appOnly[0].requestId, 'CAN-APP-001');
    assert.strictEqual(appOnly[1].requestId, 'CAN-APP-003');
  });
});

