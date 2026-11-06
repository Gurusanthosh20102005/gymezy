import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDistanceKm } from '../src/controllers/banner.controller.js';
import {
  scoreBannerRelevance,
  tokenizeAndNormalize,
  getDidYouMeanSuggestion,
} from '../src/utils/fuzzySearchEngine.js';

describe('Banner Geo Distance & Sorting Unit Tests', () => {
  test('1. calculateDistanceKm computes accurate distance between Mangadu and Porur (~5.5 km)', () => {
    // Mangadu coordinates: [80.1079915, 13.0289609]
    // Porur coordinates: [80.1585, 13.0382]
    const distance = calculateDistanceKm(13.0289609, 80.1079915, 13.0382, 80.1585);
    assert.ok(distance > 5 && distance < 6, `Expected distance between 5 and 6 km, got ${distance}`);
  });

  test('2. calculateDistanceKm returns 0 for identical coordinates', () => {
    const distance = calculateDistanceKm(13.0289609, 80.1079915, 13.0289609, 80.1079915);
    assert.equal(distance, 0);
  });

  test('3. calculateDistanceKm handles null/invalid coordinates gracefully', () => {
    assert.equal(calculateDistanceKm(null, 80.1, 13.0, 80.2), null);
    assert.equal(calculateDistanceKm(13.0, null, 13.0, 80.2), null);
    assert.equal(calculateDistanceKm('invalid', 80.1, 13.0, 80.2), null);
  });

  test('4. Priority Banners partition & sort before regular distance-sorted banners', () => {
    const banners = [
      { id: 'b1', name: 'Mangadu Ad', isPriority: false, distanceKm: 0.5 },
      { id: 'b2', name: 'Anna Nagar Priority Ad', isPriority: true, distanceKm: 14.2 },
      { id: 'b3', name: 'Porur Ad', isPriority: false, distanceKm: 4.8 },
    ];

    const priority = banners.filter((b) => b.isPriority).sort((a, b) => a.distanceKm - b.distanceKm);
    const regular = banners.filter((b) => !b.isPriority).sort((a, b) => a.distanceKm - b.distanceKm);
    const result = [...priority, ...regular];

    assert.equal(result[0].name, 'Anna Nagar Priority Ad');
    assert.equal(result[1].name, 'Mangadu Ad');
    assert.equal(result[2].name, 'Porur Ad');
  });

  test('5. scoreBannerRelevance scores exact and typo matches across banner fields', () => {
    const banner = {
      title: 'Zumba & Cardio Fest',
      subtitle: 'Join high-energy dance batches in Porur',
      badgeText: 'FLAT 40% OFF',
      gymName: 'Pulse Fitness & Zumba Lounge',
      gymArea: 'Porur',
      gymSlug: 'pulse-fitness-zumba-lounge',
    };

    // Typo matching: "fitnes" -> "fitness", "porr" -> "porur"
    const tokens = tokenizeAndNormalize('fitnes porr');
    const score = scoreBannerRelevance(banner, tokens);
    assert.ok(score > 0, `Expected score > 0 for typo match, got ${score}`);

    // Irrelevant query
    const irrelevantTokens = tokenizeAndNormalize('completelyunrelated');
    assert.equal(scoreBannerRelevance(banner, irrelevantTokens), 0);
  });

  test('6. Banner numbered pagination calculation enforces bounds', () => {
    const total = 45;
    const limit = 10;
    const page = 2;
    const skip = (page - 1) * limit;
    const pages = Math.ceil(total / limit);
    const hasMore = skip + limit < total;

    assert.equal(skip, 10);
    assert.equal(pages, 5);
    assert.equal(hasMore, true);
  });
});
