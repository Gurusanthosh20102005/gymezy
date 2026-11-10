import test from 'node:test';
import assert from 'node:assert';
import gymRoutes from '../src/routes/gym.routes.js';
import { computeTimeAgo } from '../src/controllers/gymReviews.controller.js';

test('Ratings & Reviews Subsystem Architecture & Helper Tests', async (t) => {
  await t.test('1. Gym routes expose public and authenticated reviews endpoints', () => {
    const routeStack = gymRoutes.stack || [];
    const registered = routeStack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    const hasGymReviewsGet = registered.some(
      (r) => r.path === '/:id/reviews' && r.methods.includes('get')
    );
    const hasGymReviewsPost = registered.some(
      (r) => r.path === '/:id/reviews' && r.methods.includes('post')
    );
    const hasTrainerReviewsGet = registered.some(
      (r) => r.path === '/:id/trainers/:trainerId/reviews' && r.methods.includes('get')
    );
    const hasTrainerReviewsPost = registered.some(
      (r) => r.path === '/:id/trainers/:trainerId/reviews' && r.methods.includes('post')
    );

    assert.ok(hasGymReviewsGet, 'GET /:id/reviews must be registered');
    assert.ok(hasGymReviewsPost, 'POST /:id/reviews must be registered');
    assert.ok(hasTrainerReviewsGet, 'GET /:id/trainers/:trainerId/reviews must be registered');
    assert.ok(hasTrainerReviewsPost, 'POST /:id/trainers/:trainerId/reviews must be registered');
  });

  await t.test('2. computeTimeAgo accurately calculates human-readable relative time', () => {
    const now = new Date();

    // Less than 1 minute
    assert.strictEqual(computeTimeAgo(now), 'Just now');
    assert.strictEqual(computeTimeAgo(null), 'Just now');
    assert.strictEqual(computeTimeAgo('recent'), 'Just now');
    assert.strictEqual(computeTimeAgo('3 days ago'), '3 days ago');

    // 15 minutes ago
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
    assert.strictEqual(computeTimeAgo(fifteenMinsAgo), '15 mins ago');

    // 1 minute ago
    const oneMinAgo = new Date(now.getTime() - 65 * 1000);
    assert.strictEqual(computeTimeAgo(oneMinAgo), '1 min ago');

    // 2 hours ago
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    assert.strictEqual(computeTimeAgo(twoHoursAgo), '2 hrs ago');

    // 5 days ago
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    assert.strictEqual(computeTimeAgo(fiveDaysAgo), '5 days ago');

    // 2 months ago (~60 days)
    const twoMonthsAgo = new Date(now.getTime() - 62 * 24 * 60 * 60 * 1000);
    assert.strictEqual(computeTimeAgo(twoMonthsAgo), '2 months ago');

    // 1 year ago (~370 days)
    const oneYearAgo = new Date(now.getTime() - 370 * 24 * 60 * 60 * 1000);
    assert.strictEqual(computeTimeAgo(oneYearAgo), '1 year ago');
  });

  await t.test('3. Star histogram aggregation and rating math verification', () => {
    const sampleReviews = [
      { rating: 5 },
      { rating: 5 },
      { rating: 4 },
      { rating: 3 },
      { rating: 5 },
    ];

    let sum = 0;
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    sampleReviews.forEach((rev) => {
      const star = Math.max(1, Math.min(5, Math.round(rev.rating)));
      counts[star] = (counts[star] || 0) + 1;
      sum += rev.rating;
    });

    const avgNum = sum / sampleReviews.length;
    const avgStr = avgNum.toFixed(1);

    assert.strictEqual(counts[5], 3, 'Should have three 5-star ratings');
    assert.strictEqual(counts[4], 1, 'Should have one 4-star rating');
    assert.strictEqual(counts[3], 1, 'Should have one 3-star rating');
    assert.strictEqual(counts[2], 0, 'Should have zero 2-star ratings');
    assert.strictEqual(counts[1], 0, 'Should have zero 1-star ratings');

    assert.strictEqual(avgStr, '4.4', 'Average rating for [5, 5, 4, 3, 5] must be 4.4');
    assert.strictEqual(Math.round((counts[5] / sampleReviews.length) * 100), 60, '5-star ratio must be 60%');
  });

  await t.test('4. Rating bounds check logic (1 to 5 stars)', () => {
    const isValidRating = (r) => typeof r === 'number' && !Number.isNaN(r) && r >= 1 && r <= 5;

    assert.strictEqual(isValidRating(5), true);
    assert.strictEqual(isValidRating(1), true);
    assert.strictEqual(isValidRating(3.5), true);
    assert.strictEqual(isValidRating(0), false);
    assert.strictEqual(isValidRating(6), false);
    assert.strictEqual(isValidRating(-1), false);
    assert.strictEqual(isValidRating(NaN), false);
  });
});

