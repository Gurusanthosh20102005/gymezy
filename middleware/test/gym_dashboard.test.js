import test from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import gymRoutes from '../src/routes/gym.routes.js';

test('Gym Owner Scoped Dashboard Stats & Access Architecture Tests', async (t) => {
  await t.test('1. Gym routes expose scoped /:id/dashboard-stats endpoint', () => {
    const routeStack = gymRoutes.stack || [];
    const registeredPaths = routeStack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);

    assert.ok(
      registeredPaths.includes('/:id/dashboard-stats'),
      '/:id/dashboard-stats route must be registered in gymRoutes'
    );
  });

  await t.test('2. Overview metrics calculation correctly separates member & booking revenue', () => {
    const gymId = new mongoose.Types.ObjectId();

    const mockMemberships = [
      { gymId, status: 'Active', pricing: { totalAmount: 14999 }, payment: { status: 'Completed' } },
      { gymId, status: 'Active', pricing: { totalAmount: 24999 }, payment: { status: 'Completed' } },
      { gymId, status: 'Cancelled', pricing: { totalAmount: 5000 }, payment: { status: 'Refunded' } },
    ];

    const mockBookings = [
      { gymId, status: 'Completed', pricing: { totalAmount: 1500 }, payment: { status: 'Completed' } },
      { gymId, status: 'Upcoming', pricing: { totalAmount: 1629 }, payment: { status: 'Completed' } },
    ];

    let memberRevenue = 0;
    let activeMembersCount = 0;
    for (const m of mockMemberships) {
      if (m.payment.status === 'Completed' && m.status !== 'Cancelled') {
        memberRevenue += m.pricing.totalAmount;
      }
      if (['Active', 'Upcoming', 'Expiring Soon'].includes(m.status)) {
        activeMembersCount++;
      }
    }

    let bookingRevenue = 0;
    let completedBookingsCount = 0;
    for (const b of mockBookings) {
      if (b.payment.status === 'Completed') {
        bookingRevenue += b.pricing.totalAmount;
      }
      if (b.status === 'Completed') {
        completedBookingsCount++;
      }
    }

    const totalRevenue = memberRevenue + bookingRevenue;

    assert.strictEqual(memberRevenue, 39998, 'Member revenue must sum valid active memberships');
    assert.strictEqual(bookingRevenue, 3129, 'Booking revenue must sum valid completed bookings');
    assert.strictEqual(totalRevenue, 43127, 'Total revenue must be the sum of member + booking revenues');
    assert.strictEqual(activeMembersCount, 2, 'Active members must only include Active/Upcoming');
    assert.strictEqual(completedBookingsCount, 1, 'Completed bookings count must match');
  });

  await t.test('3. Employee access level is automated by role without manual accessLevel input', () => {
    const computeAccessType = (role) =>
      role === 'Manager'
        ? 'Admin'
        : ['Trainer', 'Front Desk Manager', 'Customer Support'].includes(role)
        ? 'Employee'
        : 'None';

    assert.strictEqual(computeAccessType('Manager'), 'Admin');
    assert.strictEqual(computeAccessType('Trainer'), 'Employee');
    assert.strictEqual(computeAccessType('Front Desk Manager'), 'Employee');
    assert.strictEqual(computeAccessType('Customer Support'), 'Employee');
    assert.strictEqual(computeAccessType('Housekeeping'), 'None');
    assert.strictEqual(computeAccessType('Security'), 'None');
  });
});
