import test from 'node:test';
import assert from 'node:assert';
import gymRoutes from '../src/routes/gym.routes.js';
import {
  tokenizeAndNormalize,
  isFuzzyMatch,
  scoreGymRelevance,
  getDidYouMeanSuggestion,
} from '../src/utils/searchHelper.js';

test('Super Admin Gyms Fleet & Fuzzy Search Architecture Tests', async (t) => {
  await t.test('1. Gym routes expose /admin/fleet endpoint', () => {
    const routeStack = gymRoutes.stack || [];
    const registeredPaths = routeStack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);

    assert.ok(
      registeredPaths.includes('/admin/fleet'),
      '/admin/fleet route must be registered in gymRoutes'
    );
  });

  await t.test('2. Typo-tolerant search correctly matches gym names and localities', () => {
    const sampleGym = {
      partnerId: 'GYM018',
      name: 'FitZone Luxury Club - Anna Nagar',
      area: 'Anna Nagar',
      city: 'Chennai',
      phone: '+919876543210',
      ownerName: 'Vikramaditya Verma',
      workouts: ['Strength Training', 'CrossFit', 'Cardio'],
      facilities: ['AC Gym', 'Steam Room', 'Lockers'],
      tags: ['Luxury', 'Elite', 'Strength'],
      address: '2nd Avenue, Anna Nagar, Chennai - 600040',
    };

    // Exact match
    const exactTokens = tokenizeAndNormalize('FitZone');
    const exactScore = scoreGymRelevance(sampleGym, exactTokens);
    assert.ok(exactScore > 0, 'Exact name match must yield positive score');

    // Typo match (1 edit distance: 'fitnes' -> 'fitness' or 'ana' -> 'anna')
    const typoTokens = tokenizeAndNormalize('ana nagar');
    const typoScore = scoreGymRelevance(sampleGym, typoTokens);
    assert.ok(typoScore > 0, 'Typo in locality "ana nagar" must match "Anna Nagar"');

    // Partner ID match
    const partnerIdTokens = tokenizeAndNormalize('GYM018');
    const partnerScore = scoreGymRelevance(sampleGym, partnerIdTokens);
    assert.ok(partnerScore >= 12, 'Partner ID match must receive high weight (>= 12)');

    // Non-matching query should score 0
    const nonMatchTokens = tokenizeAndNormalize('Zumba Coimbatore Swimming');
    const nonMatchScore = scoreGymRelevance(sampleGym, nonMatchTokens);
    assert.strictEqual(nonMatchScore, 0, 'Unrelated tokens must score 0');
  });

  await t.test('3. getDidYouMeanSuggestion detects close typos of fitness and Chennai terms', () => {
    const typo1 = getDidYouMeanSuggestion('fitnes studio');
    assert.ok(typo1, 'Should suggest correction for "fitnes"');
    assert.match(typo1, /fitness/i, 'Suggestion should include "Fitness"');

    const typo2 = getDidYouMeanSuggestion('velachry');
    assert.ok(typo2, 'Should suggest correction for "velachry"');
    assert.match(typo2, /velachery/i, 'Suggestion should correct to "Velachery"');
  });

  await t.test('4. Server-side pagination bounds and page calculation', () => {
    const totalCount = 115;
    const limit = 10;
    const page = 2;
    const pages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;

    assert.strictEqual(pages, 12, '115 items at 10 per page must equal 12 pages');
    assert.strictEqual(skip, 10, 'Page 2 at 10 per page must skip 10 items');
    assert.strictEqual(skip + limit < totalCount, true, 'Page 2 has more items');
  });

  await t.test('5. Gym routes expose /options endpoint for lightweight dropdowns', () => {
    const routeStack = gymRoutes.stack || [];
    const registeredPaths = routeStack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);

    assert.ok(
      registeredPaths.includes('/options'),
      '/options route must be registered in gymRoutes'
    );
  });

  await t.test('6. Relaxed spacing regex matches collapsed search queries (e.g. supermax -> Super Max Gym)', () => {
    const query = 'supermax';
    const cleanAlnum = query.replace(/[^a-zA-Z0-9]/g, '');
    const relaxedPattern = cleanAlnum.split('').map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\-_]*');
    const regex = new RegExp(relaxedPattern, 'i');

    assert.ok(regex.test('Super Max Gym'), '"supermax" must match "Super Max Gym"');
    assert.ok(regex.test('SuperMax Fitness'), '"supermax" must match "SuperMax Fitness"');
    assert.ok(regex.test('Super-Max Arena'), '"supermax" must match "Super-Max Arena"');
    assert.strictEqual(regex.test('PowerMax Gym'), false, '"supermax" must not match "PowerMax"');
  });
});

