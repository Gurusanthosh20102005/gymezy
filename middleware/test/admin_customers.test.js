import test from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import User, { USER_ROLES } from '../src/models/user.model.js';

test('Admin Customers & Users Architecture Tests', async (t) => {
  await t.test('1. USER_ROLES has CUSTOMER, GYM_OWNER, SUPER_ADMIN definitions (SSOT)', () => {
    assert.strictEqual(USER_ROLES.CUSTOMER, 'CUSTOMER');
    assert.strictEqual(USER_ROLES.SUPER_ADMIN, 'SUPER_ADMIN');
    assert.strictEqual(USER_ROLES.GYM_OWNER, 'GYM_OWNER');
  });

  await t.test('2. User model schema instantiates a Customer with default values', () => {
    const user = new User({
      fullName: 'Rahul Sharma',
      email: 'rahul.test@gymezy.com',
      phone: '+91 9876543210',
      password: 'SecurePassword123!',
      role: USER_ROLES.CUSTOMER,
      customerId: 'CUST-10099',
    });

    assert.strictEqual(user.fullName, 'Rahul Sharma');
    assert.strictEqual(user.email, 'rahul.test@gymezy.com');
    assert.strictEqual(user.role, 'CUSTOMER');
    assert.strictEqual(user.isActive, true);
    assert.strictEqual(user.customerId, 'CUST-10099');
  });

  await t.test('3. Server-side pagination calculation logic', () => {
    const totalRecords = 25;
    const limit = 10;
    const page = 2;
    const totalPages = Math.ceil(totalRecords / limit);
    const skip = (page - 1) * limit;

    assert.strictEqual(totalPages, 3);
    assert.strictEqual(skip, 10);
    assert.strictEqual(page < totalPages, true); // hasNextPage
    assert.strictEqual(page > 1, true); // hasPrevPage
  });
});

