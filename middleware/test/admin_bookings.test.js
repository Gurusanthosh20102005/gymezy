import test from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import Booking, { BOOKING_TYPES, BOOKING_STATUS } from '../src/models/booking.model.js';
import { scoreBookingRelevance } from '../src/utils/fuzzySearchEngine.js';

test('Admin Bookings & Group Classes Architecture Tests', async (t) => {
  await t.test('1. BOOKING_TYPES contains SECTION, GROUP_CLASS, GYM_SESSION (SSOT)', () => {
    assert.ok(BOOKING_TYPES.includes('SECTION'));
    assert.ok(BOOKING_TYPES.includes('GROUP_CLASS'));
    assert.ok(BOOKING_TYPES.includes('GYM_SESSION'));
  });

  await t.test('2. BOOKING_STATUS contains Upcoming, Active, Completed, Cancelled', () => {
    assert.ok(BOOKING_STATUS.includes('Upcoming'));
    assert.ok(BOOKING_STATUS.includes('Active'));
    assert.ok(BOOKING_STATUS.includes('Completed'));
    assert.ok(BOOKING_STATUS.includes('Cancelled'));
  });

  await t.test('3. Booking model instantiates Group Class and Session Booking correctly', () => {
    const dummyUserId = new mongoose.Types.ObjectId();
    const dummyGymId = new mongoose.Types.ObjectId();

    const groupBooking = new Booking({
      bookingId: 'BK-GC-101',
      userId: dummyUserId,
      gymId: dummyGymId,
      bookingType: 'GROUP_CLASS',
      title: 'Power Yoga Sunrise Batch',
      category: 'Yoga',
      timeSlot: '06:30 AM - 07:30 AM',
      pricing: { subtotal: 500, discount: 0, totalAmount: 500 },
      payment: { transactionId: 'TXN_TEST_101', method: 'UPI', status: 'Completed' },
      status: 'Active',
    });

    assert.strictEqual(groupBooking.bookingType, 'GROUP_CLASS');
    assert.strictEqual(groupBooking.title, 'Power Yoga Sunrise Batch');
    assert.strictEqual(groupBooking.status, 'Active');

    const sessionBooking = new Booking({
      bookingId: 'BK-SS-102',
      userId: dummyUserId,
      gymId: dummyGymId,
      bookingType: 'SECTION',
      title: 'Strength & Conditioning Area Pass',
      category: 'Gym Session',
      timeSlot: '05:00 PM - 06:00 PM',
      pricing: { subtotal: 350, discount: 50, totalAmount: 300 },
      payment: { transactionId: 'TXN_TEST_102', method: 'UPI', status: 'Completed' },
      status: 'Upcoming',
    });

    assert.strictEqual(sessionBooking.bookingType, 'SECTION');
    assert.strictEqual(sessionBooking.status, 'Upcoming');
  });

  await t.test('4. Booking type filtering partition logic', () => {
    const typeSessionFilter = (type) => ['SECTION', 'GYM_SESSION'].includes(type);
    const typeGroupClassFilter = (type) => type === 'GROUP_CLASS';

    assert.strictEqual(typeSessionFilter('SECTION'), true);
    assert.strictEqual(typeSessionFilter('GYM_SESSION'), true);
    assert.strictEqual(typeSessionFilter('GROUP_CLASS'), false);

    assert.strictEqual(typeGroupClassFilter('GROUP_CLASS'), true);
    assert.strictEqual(typeGroupClassFilter('SECTION'), false);
  });

  await t.test('5. scoreBookingRelevance correctly scores exact and typo-tolerant queries', () => {
    const booking = {
      bookingId: 'BK100245',
      title: 'Zumba Morning Cohort',
      category: 'Zumba',
      user: { fullName: 'Arun Kumar', phone: '9876543210', email: 'arun@example.com', customerId: 'CUST1001' },
      gym: { name: 'FitZone Luxury Club', partnerId: 'GYM18', area: 'Anna Nagar', city: 'Chennai' },
      status: 'Active',
    };

    // Exact bookingId match
    const scoreId = scoreBookingRelevance(booking, ['bk100245']);
    assert.ok(scoreId > 10, 'Expected high score for booking ID match');

    // Typo in gym area: 'ana nagar' -> 'Anna Nagar'
    const scoreAreaTypo = scoreBookingRelevance(booking, ['ana', 'nagar']);
    assert.ok(scoreAreaTypo > 0, 'Expected typo match for Anna Nagar');

    // Typo in customer name: 'kumaar' -> 'Kumar'
    const scoreNameTypo = scoreBookingRelevance(booking, ['kumaar']);
    assert.ok(scoreNameTypo > 0, 'Expected typo match for Kumar');

    // Non-matching term
    const scoreNone = scoreBookingRelevance(booking, ['unrelatedxyz']);
    assert.strictEqual(scoreNone, 0);
  });
});

