import test from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import User, { USER_ROLES } from '../src/models/user.model.js';
import adminRouter from '../src/routes/admin.routes.js';
import { scoreReportCustomerRelevance, tokenizeAndNormalize } from '../src/utils/fuzzySearchEngine.js';

test('Admin Customers & Users Architecture Tests', async (t) => {
  await t.test('1. USER_ROLES has CUSTOMER, GYM_OWNER, SUPER_ADMIN definitions (SSOT)', () => {
    assert.strictEqual(USER_ROLES.CUSTOMER, 'CUSTOMER');
    assert.strictEqual(USER_ROLES.SUPER_ADMIN, 'SUPER_ADMIN');
    assert.strictEqual(USER_ROLES.GYM_OWNER, 'GYM_OWNER');
    assert.strictEqual(USER_ROLES.MANAGER, 'MANAGER');
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

  await t.test('4. Admin routes expose /reports/customers endpoint', () => {
    const route = adminRouter.stack.find((layer) => layer.route && layer.route.path === '/reports/customers');
    assert.ok(route, 'Expected /reports/customers route to be defined in adminRouter');
    assert.strictEqual(route.route.methods.get, true);
  });

  await t.test('5. scoreReportCustomerRelevance scores exact and fuzzy matches for customer reports', () => {
    const sampleRecord = {
      name: 'Arun Kumar',
      customerId: 'CUST100245',
      phone: '+91 98765 43210',
      email: 'arun.kumar@gmail.com',
      status: 'Active',
    };

    const exactTokens = tokenizeAndNormalize('arun');
    const exactScore = scoreReportCustomerRelevance(sampleRecord, exactTokens);
    assert.strictEqual(exactScore, 10, `Expected exact score 10, got ${exactScore}`);

    const idTokens = tokenizeAndNormalize('CUST100245');
    const idScore = scoreReportCustomerRelevance(sampleRecord, idTokens);
    assert.strictEqual(idScore, 14, `Expected customerId match score 14, got ${idScore}`);

    const typoTokens = tokenizeAndNormalize('Aruun'); // 1-edit typo
    const typoScore = scoreReportCustomerRelevance(sampleRecord, typoTokens);
    assert.ok(typoScore > 5, `Expected typo score > 5, got ${typoScore}`);

    const nonMatchTokens = tokenizeAndNormalize('NonExistentCustomerNameXYZ');
    const zeroScore = scoreReportCustomerRelevance(sampleRecord, nonMatchTokens);
    assert.strictEqual(zeroScore, 0, `Expected zero score, got ${zeroScore}`);
  });
});

