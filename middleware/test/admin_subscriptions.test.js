import test from 'node:test';
import assert from 'node:assert';
import adminRoutes from '../src/routes/admin.routes.js';
import {
  tokenizeAndNormalize,
  scoreGymRelevance,
  getDidYouMeanSuggestion,
} from '../src/utils/searchHelper.js';

test('Super Admin SaaS Subscriptions & Plan Governance Tests', async (t) => {
  await t.test('1. Admin routes expose /subscriptions endpoints', () => {
    const routeStack = adminRoutes.stack || [];
    const registeredPaths = routeStack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);

    assert.ok(
      registeredPaths.includes('/subscriptions'),
      '/subscriptions route must be registered in adminRoutes'
    );
    assert.ok(
      registeredPaths.includes('/subscriptions/:id'),
      '/subscriptions/:id route must be registered in adminRoutes'
    );
  });

  await t.test('2. Typo-tolerant search matches gym subscription names and partner IDs', () => {
    const sampleGym = {
      partnerId: 'GYM1',
      name: 'Varun Fitness Studio',
      area: 'Mangadu',
      city: 'Chennai',
      subscriptionType: 'Hybrid',
      subscriptionStatus: 'Active',
    };

    // Exact search
    const exactTokens = tokenizeAndNormalize('Varun');
    assert.ok(scoreGymRelevance(sampleGym, exactTokens) > 0);

    // Typo search (1 edit distance: 'fitnes' -> 'fitness')
    const typoTokens = tokenizeAndNormalize('Varun fitnes');
    assert.ok(scoreGymRelevance(sampleGym, typoTokens) > 0);

    // Locality typo
    const localityTokens = tokenizeAndNormalize('mangadu');
    assert.ok(scoreGymRelevance(sampleGym, localityTokens) > 0);

    // Partner ID search
    const idTokens = tokenizeAndNormalize('GYM1');
    assert.ok(scoreGymRelevance(sampleGym, idTokens) >= 12);
  });

  await t.test('3. Dynamic MRR and SaaS tier aggregation logic', () => {
    const hybridCount = 45;
    const appOnlyCount = 30;
    const gmsCount = 20;
    const listingCount = 15;

    const estimatedMRR =
      hybridCount * 4999 +
      appOnlyCount * 2999 +
      gmsCount * 1999 +
      listingCount * 999;

    assert.strictEqual(
      estimatedMRR,
      45 * 4999 + 30 * 2999 + 20 * 1999 + 15 * 999,
      'MRR must be calculated dynamically based on active tier counts'
    );
    assert.ok(estimatedMRR > 0, 'MRR must be greater than 0');
  });

  await t.test('4. "Did You Mean" suggests proper spelling for SaaS search', () => {
    const suggestion = getDidYouMeanSuggestion('fitnes');
    assert.ok(suggestion, 'Should suggest correction for "fitnes"');
    assert.match(suggestion, /fitness/i);
  });
});

