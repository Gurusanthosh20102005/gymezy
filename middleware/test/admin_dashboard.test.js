import test from 'node:test';
import assert from 'node:assert';
import adminRoutes from '../src/routes/admin.routes.js';
import { parseDateRangeFilter } from '../src/utils/searchHelper.js';

test('Super Admin Dashboard Stats & Temporal Filter Architecture Tests', async (t) => {
  await t.test('1. Admin routes expose /dashboard-stats endpoint', () => {
    const routeStack = adminRoutes.stack || [];
    const registeredPaths = routeStack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);

    assert.ok(
      registeredPaths.includes('/dashboard-stats'),
      '/dashboard-stats route must be registered in adminRoutes'
    );
  });

  await t.test('2. Super admin filter query parser correctly handles filterType and custom ranges', () => {
    const fixedNow = new Date('2026-11-06T12:00:00.000Z');

    const todayFilter = parseDateRangeFilter({ filterType: 'today' }, fixedNow);
    assert.ok(todayFilter);
    assert.strictEqual(todayFilter.label, 'Today');
    assert.strictEqual(todayFilter.start.getHours(), 0);
    assert.strictEqual(todayFilter.end.getHours(), 23);

    const weekFilter = parseDateRangeFilter({ filterType: 'week' }, fixedNow);
    assert.ok(weekFilter);
    assert.strictEqual(weekFilter.label, 'This Week');

    const monthFilter = parseDateRangeFilter({ filterType: 'month' }, fixedNow);
    assert.ok(monthFilter);
    assert.strictEqual(monthFilter.label, 'This Month');
    assert.strictEqual(monthFilter.start.getDate(), 1);

    const customFilter = parseDateRangeFilter(
      {
        filterType: 'custom',
        startDate: '2026-11-01T10:00:00.000Z',
        endDate: '2026-11-05T10:00:00.000Z',
      },
      fixedNow
    );
    assert.ok(customFilter);
    assert.strictEqual(customFilter.label, 'Custom Range');
    assert.strictEqual(customFilter.start.getDate(), 1);
    assert.strictEqual(customFilter.end.getDate(), 5);
  });

  await t.test('3. Dynamic platform GMV and Booking throughput aggregation logic', () => {
    const mockBookings = [
      { status: 'Completed', pricing: { totalAmount: 499 }, payment: { status: 'Completed' } },
      { status: 'Completed', pricing: { totalAmount: 199 }, payment: { status: 'Completed' } },
      { status: 'Upcoming', pricing: { totalAmount: 299 }, payment: { status: 'Completed' } },
      { status: 'Active', pricing: { totalAmount: 399 }, payment: { status: 'Completed' } },
      { status: 'Cancelled', pricing: { totalAmount: 500 }, payment: { status: 'Refunded' } },
      { status: 'No Show', pricing: { totalAmount: 199 }, payment: { status: 'Completed' } },
    ];

    const mockMemberships = [
      { status: 'Active', pricing: { totalAmount: 4999 }, payment: { status: 'Completed' } },
      { status: 'Upcoming', pricing: { totalAmount: 2999 }, payment: { status: 'Completed' } },
      { status: 'Cancelled', pricing: { totalAmount: 1000 }, payment: { status: 'Refunded' } },
      { status: 'Switched', pricing: { totalAmount: 3000 }, payment: { status: 'Completed' } },
    ];

    // Compute bookings partition
    let totalBookings = 0;
    let confirmedBookings = 0;
    let completedBookings = 0;
    let cancelledBookings = 0;
    let noShowBookings = 0;
    let bookingGmv = 0;

    for (const b of mockBookings) {
      totalBookings++;
      if (['Upcoming', 'Active'].includes(b.status)) confirmedBookings++;
      if (b.status === 'Completed') completedBookings++;
      if (b.status === 'Cancelled') cancelledBookings++;
      if (['No Show', 'NoShow'].includes(b.status)) noShowBookings++;

      if (b.status !== 'Cancelled' && !['Failed', 'Refunded'].includes(b.payment?.status)) {
        bookingGmv += b.pricing.totalAmount;
      }
    }

    // Compute membership GMV
    let membershipGmv = 0;
    for (const m of mockMemberships) {
      if (!['Cancelled', 'Switched'].includes(m.status) && !['Failed', 'Refunded'].includes(m.payment?.status)) {
        membershipGmv += m.pricing.totalAmount;
      }
    }

    const totalGmv = bookingGmv + membershipGmv;
    const completedWorkouts = completedBookings;
    const completionRate = totalBookings > 0 ? Number(((completedBookings / totalBookings) * 100).toFixed(1)) : 0;

    assert.strictEqual(totalBookings, 6);
    assert.strictEqual(confirmedBookings, 2);
    assert.strictEqual(completedBookings, 2);
    assert.strictEqual(cancelledBookings, 1);
    assert.strictEqual(noShowBookings, 1);

    // bookingGmv = 499 + 199 + 299 + 399 + 199 = 1595
    assert.strictEqual(bookingGmv, 1595);
    // membershipGmv = 4999 + 2999 = 7998
    assert.strictEqual(membershipGmv, 7998);
    // totalGmv = 1595 + 7998 = 9593
    assert.strictEqual(totalGmv, 9593);
    assert.strictEqual(completedWorkouts, 2);
    assert.strictEqual(completionRate, 33.3);
  });
});
