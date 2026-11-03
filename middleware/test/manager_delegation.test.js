import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Employee } from '../src/models/employee.model.js';
import { Gym } from '../src/models/gym.model.js';
import { MembershipSwitchRequest } from '../src/models/membershipSwitchRequest.model.js';
import { MembershipCancellation } from '../src/models/membershipCancellation.model.js';

test('Gym Manager vs. Gym Admin Delegation Architecture Tests', async (t) => {
  await t.test('1. Employee model schema initializes managerPermissions with 4 default booleans', () => {
    const manager = new Employee({
      gymId: new mongoose.Types.ObjectId(),
      gymPartnerId: 'GYM-TN-001',
      employeeId: 'EMP-001',
      name: 'Test Manager',
      role: 'Manager',
    });

    assert.ok(manager.managerPermissions, 'managerPermissions object should exist');
    assert.strictEqual(manager.managerPermissions.requireStaffApproval, true);
    assert.strictEqual(manager.managerPermissions.requirePlanSwitchApproval, true);
    assert.strictEqual(manager.managerPermissions.requireCancellationApproval, true);
    assert.strictEqual(manager.managerPermissions.requireProfileEditApproval, true);
  });

  await t.test('2. Employee model allows customizable managerPermissions', () => {
    const customManager = new Employee({
      gymId: new mongoose.Types.ObjectId(),
      gymPartnerId: 'GYM-TN-001',
      employeeId: 'EMP-002',
      name: 'Autonomous Manager',
      role: 'Manager',
      managerPermissions: {
        requireStaffApproval: false,
        requirePlanSwitchApproval: false,
        requireCancellationApproval: true,
        requireProfileEditApproval: false,
      },
    });

    assert.strictEqual(customManager.managerPermissions.requireStaffApproval, false);
    assert.strictEqual(customManager.managerPermissions.requirePlanSwitchApproval, false);
    assert.strictEqual(customManager.managerPermissions.requireCancellationApproval, true);
    assert.strictEqual(customManager.managerPermissions.requireProfileEditApproval, false);
  });

  await t.test('3. Gym model schema supports pendingManagerEdits', () => {
    const testGym = new Gym({
      name: 'Test Gym',
      ownerName: 'Admin Owner',
      ownerEmail: 'owner@gym.com',
      ownerPhone: '9876543210',
      address: '123 Test St',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600001',
      pendingManagerEdits: {
        submittedByName: 'Junior Manager',
        status: 'PENDING_ADMIN_APPROVAL',
        edits: { singleSessionPrice: 350 },
      },
    });

    assert.strictEqual(testGym.pendingManagerEdits.status, 'PENDING_ADMIN_APPROVAL');
    assert.strictEqual(testGym.pendingManagerEdits.submittedByName, 'Junior Manager');
    assert.strictEqual(testGym.pendingManagerEdits.edits.singleSessionPrice, 350);
  });

  await t.test('4. MembershipSwitchRequest supports PENDING_GYM_ADMIN_APPROVAL status', () => {
    const switchReq = new MembershipSwitchRequest({
      requestId: 'REQ-SW-TEST-1',
      membershipId: new mongoose.Types.ObjectId(),
      gymId: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(),
      targetPlan: { tier: 'Annual', priceINR: 15000, durationDays: 365 },
      quoteSnapshot: {
        switchType: 'UPGRADE',
        daysRemaining: 100,
        proRatedCreditPaise: 500000,
        netPayablePaise: 1000000,
      },
      status: 'PENDING_GYM_ADMIN_APPROVAL',
    });

    assert.strictEqual(switchReq.status, 'PENDING_GYM_ADMIN_APPROVAL');
  });

  await t.test('5. MembershipCancellation supports PENDING_GYM_ADMIN_APPROVAL status', () => {
    const cancellation = new MembershipCancellation({
      requestId: 'CAN-TEST-1',
      membershipId: new mongoose.Types.ObjectId(),
      gymId: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(),
      originalAmount: 8999,
      usedAmount: 2000,
      maximumRefundAmount: 6999,
      status: 'PENDING_GYM_ADMIN_APPROVAL',
    });

    assert.strictEqual(cancellation.status, 'PENDING_GYM_ADMIN_APPROVAL');
  });
});
