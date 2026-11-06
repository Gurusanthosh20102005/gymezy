import assert from 'node:assert/strict';
import {
  isBookingCompleted,
  evaluateBookingStatus,
  calculateBookingCancellationQuote,
  getStartOfDay,
  getEndOfDay,
} from '../src/services/bookingProration.service.js';

console.log('🧪 Starting Booking Lifecycle & Cancellation Proration Tests...\n');

// Test 1: Single-day session that occurred yesterday must be completed
{
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const pastBooking = {
    status: 'Active',
    startDate: yesterday,
    endDate: yesterday,
    durationDays: 1,
    sessionsCount: 1,
    pricing: { totalAmount: 500 },
  };

  const isCompleted = isBookingCompleted(pastBooking, new Date());
  assert.equal(isCompleted, true, 'Yesterday single-day session must evaluate to completed');

  const evaluatedStatus = evaluateBookingStatus(pastBooking, new Date());
  assert.equal(evaluatedStatus, 'Completed', 'Status must evaluate to Completed');

  const quote = calculateBookingCancellationQuote(pastBooking, new Date());
  assert.equal(quote.canCancel, false, 'Completed booking cannot be cancelled');
  assert.equal(quote.refundAmount, 0, 'Completed booking has 0 refund');
  console.log('✅ Test 1 Passed: Past single-day session is auto-completed and cannot be cancelled.');
}

// Test 2: Pre-start future session (e.g. tomorrow) -> 100% full refund, no gym approval needed
{
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 5);

  const futureBooking = {
    status: 'Upcoming',
    startDate: tomorrow,
    endDate: nextWeek,
    durationDays: 5,
    sessionsCount: 5,
    pricing: { totalAmount: 1500 },
  };

  const isCompleted = isBookingCompleted(futureBooking, new Date());
  assert.equal(isCompleted, false, 'Future booking must not be completed');

  const evaluatedStatus = evaluateBookingStatus(futureBooking, new Date());
  assert.equal(evaluatedStatus, 'Upcoming', 'Future booking must remain Upcoming');

  const quote = calculateBookingCancellationQuote(futureBooking, new Date());
  assert.equal(quote.canCancel, true, 'Future booking can be cancelled');
  assert.equal(quote.consumedDays, 0, 'Consumed days must be 0 prior to start date');
  assert.equal(quote.deductedAmount, 0, 'Deducted amount must be 0');
  assert.equal(quote.refundAmount, 1500, 'Full 100% refund must be granted');
  assert.equal(quote.requiresGymApproval, false, 'Pre-start cancellation requires no gym approval');
  console.log('✅ Test 2 Passed: Pre-start cancellation yields instant 100% refund without gym approval.');
}

// Test 3: Multi-day session partially consumed (5-day booking started 2 days ago)
{
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysLater = new Date();
  twoDaysLater.setDate(twoDaysLater.getDate() + 2);

  const partialBooking = {
    status: 'Active',
    startDate: twoDaysAgo,
    endDate: twoDaysLater,
    durationDays: 5,
    sessionsCount: 5,
    pricing: { totalAmount: 1000 },
  };

  const quote = calculateBookingCancellationQuote(partialBooking, new Date());
  assert.equal(quote.canCancel, true, 'Partially consumed booking can request cancellation');
  // 2 days ago + today = 3 elapsed days
  assert.equal(quote.consumedDays, 3, 'Elapsed days from start to today must be 3');
  assert.equal(quote.remainingDays, 2, 'Remaining days must be 2');
  assert.equal(quote.deductedAmount, 600, 'Consumed 3 of 5 days: 3 * (1000/5) = 600');
  assert.equal(quote.refundAmount, 400, 'Net refund: 1000 - 600 = 400');
  assert.equal(quote.requiresGymApproval, true, 'Partially consumed cancellation requires gym owner review');
  console.log('✅ Test 3 Passed: Multi-day partial consumption prorates correctly and requires gym approval.');
}

// Test 4: Custom dates booking with 3 dates, 1 past date and 2 future dates
{
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextDay = new Date();
  nextDay.setDate(nextDay.getDate() + 2);

  const customBooking = {
    status: 'Active',
    isCustomDates: true,
    customDates: [
      { date: yesterday, status: 'Attended' },
      { date: tomorrow, status: 'Scheduled' },
      { date: nextDay, status: 'Scheduled' },
    ],
    pricing: { totalAmount: 900 },
  };

  const isCompleted = isBookingCompleted(customBooking, new Date());
  assert.equal(isCompleted, false, 'Custom booking with future dates is not completed');

  const quote = calculateBookingCancellationQuote(customBooking, new Date());
  assert.equal(quote.canCancel, true);
  assert.equal(quote.totalDays, 3, 'Total sessions must equal 3 custom dates');
  assert.equal(quote.consumedDays, 1, 'Only yesterday has elapsed');
  assert.equal(quote.remainingDays, 2, '2 future dates remain');
  assert.equal(quote.deductedAmount, 300, '1 of 3 days deducted = 300');
  assert.equal(quote.refundAmount, 600, 'Remaining refund = 600');
  assert.equal(quote.requiresGymApproval, true);
  console.log('✅ Test 4 Passed: Custom dates booking proration works seamlessly.');
}

// Test 5: All custom dates passed -> auto completed
{
  const day1 = new Date();
  day1.setDate(day1.getDate() - 3);
  const day2 = new Date();
  day2.setDate(day2.getDate() - 2);
  const day3 = new Date();
  day3.setDate(day3.getDate() - 1);

  const completedCustomBooking = {
    status: 'Active',
    isCustomDates: true,
    customDates: [
      { date: day1, status: 'Attended' },
      { date: day2, status: 'Attended' },
      { date: day3, status: 'Missed' },
    ],
    pricing: { totalAmount: 900 },
  };

  const isCompleted = isBookingCompleted(completedCustomBooking, new Date());
  assert.equal(isCompleted, true, 'All custom dates passed must evaluate to completed');

  const quote = calculateBookingCancellationQuote(completedCustomBooking, new Date());
  assert.equal(quote.canCancel, false, 'Completed custom booking cannot be cancelled');
  console.log('✅ Test 5 Passed: All custom dates passed auto-completes and blocks cancellation.');
}

console.log('\n🎉 ALL 5 BOOKING LIFECYCLE & PRORATION TESTS PASSED DETERMINISTICALLY!\n');

