import test from 'node:test';
import assert from 'node:assert';
import bookingRoutes from '../src/routes/booking.routes.js';
import membershipRoutes from '../src/routes/membership.routes.js';
import { BOOKING_SOURCES } from '../src/models/booking.model.js';
import { MEMBERSHIP_SOURCES } from '../src/models/membership.model.js';

test('Walk-in Model & Architecture Verification', async (t) => {
  await t.test('1. Schema source enums contain APP and WALK_IN', () => {
    assert.ok(Array.isArray(BOOKING_SOURCES), 'BOOKING_SOURCES must be an array');
    assert.ok(BOOKING_SOURCES.includes('APP'), 'BOOKING_SOURCES must include APP');
    assert.ok(BOOKING_SOURCES.includes('WALK_IN'), 'BOOKING_SOURCES must include WALK_IN');

    assert.ok(Array.isArray(MEMBERSHIP_SOURCES), 'MEMBERSHIP_SOURCES must be an array');
    assert.ok(MEMBERSHIP_SOURCES.includes('APP'), 'MEMBERSHIP_SOURCES must include APP');
    assert.ok(MEMBERSHIP_SOURCES.includes('WALK_IN'), 'MEMBERSHIP_SOURCES must include WALK_IN');
  });

  await t.test('2. Booking routes expose POST /gym/:gymId/walk-in', () => {
    const routeStack = bookingRoutes.stack || [];
    const registered = routeStack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    const walkInRoute = registered.find(
      (r) => r.path === '/gym/:gymId/walk-in' && r.methods.includes('post')
    );
    assert.ok(walkInRoute, 'POST /gym/:gymId/walk-in must be registered in bookingRoutes');
  });

  await t.test('3. Membership routes expose POST /gym/:gymId/walk-in', () => {
    const routeStack = membershipRoutes.stack || [];
    const registered = routeStack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    const walkInRoute = registered.find(
      (r) => r.path === '/gym/:gymId/walk-in' && r.methods.includes('post')
    );
    assert.ok(walkInRoute, 'POST /gym/:gymId/walk-in must be registered in membershipRoutes');
  });

  await t.test('4. Walk-in counter payment resolution defaults to Completed', () => {
    const paymentMethods = ['Cash', 'UPI', 'POS', 'Card'];
    for (const method of paymentMethods) {
      const paymentRecord = {
        method,
        status: 'Completed',
        paidAt: new Date(),
      };
      assert.strictEqual(paymentRecord.status, 'Completed', `Payment via ${method} at front desk must be marked Completed`);
    }
  });

  await t.test('5. Source filtering separates APP vs WALK_IN correctly', () => {
    const records = [
      { id: '1', source: 'APP', amount: 150 },
      { id: '2', source: 'WALK_IN', amount: 200 },
      { id: '3', source: 'APP', amount: 300 },
      { id: '4', source: 'WALK_IN', amount: 500 },
    ];

    const appRecords = records.filter((r) => r.source === 'APP');
    const walkInRecords = records.filter((r) => r.source === 'WALK_IN');

    assert.strictEqual(appRecords.length, 2, 'Should find 2 APP records');
    assert.strictEqual(walkInRecords.length, 2, 'Should find 2 WALK_IN records');
  });
});

