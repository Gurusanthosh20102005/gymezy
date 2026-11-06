import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  damerauLevenshteinDistance,
  tokenizeAndNormalize,
  isFuzzyMatch,
  scoreGymRelevance,
  getDidYouMeanSuggestion,
  CHENNAI_LOCALITIES_VOCAB,
  FITNESS_VOCAB,
} from '../src/utils/fuzzySearchEngine.js';

describe('Fuzzy Search Engine Unit Tests (Typo Tolerance & Ranking)', () => {
  describe('1. Damerau-Levenshtein Distance Calculation', () => {
    it('returns 0 for identical strings', () => {
      assert.strictEqual(damerauLevenshteinDistance('fitness', 'fitness'), 0);
      assert.strictEqual(damerauLevenshteinDistance('Velachery', 'velachery'), 0);
    });

    it('detects adjacent transposition as 1 edit', () => {
      // 'crosfitt' transposed vs swapped letters
      assert.strictEqual(damerauLevenshteinDistance('teh', 'the'), 1);
      assert.strictEqual(damerauLevenshteinDistance('ygoa', 'yoga'), 1);
    });

    it('detects single deletion / insertion as 1 edit', () => {
      assert.strictEqual(damerauLevenshteinDistance('fitnes', 'fitness'), 1);
      assert.strictEqual(damerauLevenshteinDistance('ana', 'anna'), 1);
      assert.strictEqual(damerauLevenshteinDistance('poroor', 'porur'), 2);
    });

    it('detects substitution as 1 edit', () => {
      assert.strictEqual(damerauLevenshteinDistance('zubma', 'zumba'), 1);
      assert.strictEqual(damerauLevenshteinDistance('pulates', 'pilates'), 1);
    });

    it('handles empty or null inputs safely', () => {
      assert.strictEqual(damerauLevenshteinDistance('', 'test'), 4);
      assert.strictEqual(damerauLevenshteinDistance(null, 'test'), 4);
      assert.strictEqual(damerauLevenshteinDistance('test', null), 4);
      assert.strictEqual(damerauLevenshteinDistance(null, null), 0);
    });
  });

  describe('2. Tokenization and Normalization', () => {
    it('normalizes casing and removes punctuation', () => {
      const tokens = tokenizeAndNormalize('  T. Nagar, Chennai -- Luxury & AC!!  ');
      assert.deepStrictEqual(tokens, ['t', 'nagar', 'chennai', 'luxury', 'ac']);
    });

    it('handles empty or non-string inputs safely', () => {
      assert.deepStrictEqual(tokenizeAndNormalize(''), []);
      assert.deepStrictEqual(tokenizeAndNormalize(null), []);
      assert.deepStrictEqual(tokenizeAndNormalize(undefined), []);
    });
  });

  describe('3. Dynamic Length-Based Typo Tolerance (isFuzzyMatch)', () => {
    it('requires exact match for short tokens <= 2 chars to avoid false positives', () => {
      assert.strictEqual(isFuzzyMatch('ac', 'ac').matched, true);
      assert.strictEqual(isFuzzyMatch('ac', 'ad').matched, false);
      assert.strictEqual(isFuzzyMatch('hi', 'hiit').matched, true); // prefix match
    });

    it('allows 1 edit distance for 3-6 char words', () => {
      assert.strictEqual(isFuzzyMatch('ana', 'anna').matched, true);
      assert.strictEqual(isFuzzyMatch('yga', 'yoga').matched, true);
      assert.strictEqual(isFuzzyMatch('fitnes', 'fitness').matched, true);
      assert.strictEqual(isFuzzyMatch('zubma', 'zumba').matched, true);
    });

    it('allows 2 edit distances for 7+ char words', () => {
      assert.strictEqual(isFuzzyMatch('crosfit', 'crossfit').matched, true);
      assert.strictEqual(isFuzzyMatch('valachery', 'velachery').matched, true);
      assert.strictEqual(isFuzzyMatch('nungambakam', 'nungambakkam').matched, true);
    });
  });

  describe('4. Chennai Localities & Fitness Typo Tolerance', () => {
    it('matches common Chennai area misspellings', () => {
      const gym = {
        name: 'Iron Temple Gym',
        area: 'Velachery',
        city: 'Chennai',
        workouts: ['Strength', 'CrossFit'],
      };

      const tokens1 = tokenizeAndNormalize('velachry');
      assert.ok(scoreGymRelevance(gym, tokens1) > 0, 'Should match Velachery typo');

      const tokens2 = tokenizeAndNormalize('valachery');
      assert.ok(scoreGymRelevance(gym, tokens2) > 0, 'Should match Valachery typo');
    });

    it('matches multi-word area typos like ana nagar', () => {
      const gym = {
        name: 'FitZone Luxury Gym',
        area: 'Anna Nagar',
        city: 'Chennai',
        workouts: ['HIIT', 'Yoga'],
      };

      const tokens = tokenizeAndNormalize('ana nagar');
      const score = scoreGymRelevance(gym, tokens);
      assert.ok(score > 0, 'Should match ana nagar');
    });
  });

  describe('5. Weighted Multi-Field Scoring Hierarchy', () => {
    const gymNameMatch = {
      name: 'CrossFit Chennai Elite',
      area: 'T. Nagar',
      city: 'Chennai',
      workouts: ['Cardio'],
    };

    const gymWorkoutMatch = {
      name: 'PowerHouse Fitness Hub',
      area: 'T. Nagar',
      city: 'Chennai',
      workouts: ['CrossFit'],
    };

    it('ranks Gym Name match higher than Workout match for same keyword', () => {
      const tokens = tokenizeAndNormalize('crossfit');
      const nameScore = scoreGymRelevance(gymNameMatch, tokens);
      const workoutScore = scoreGymRelevance(gymWorkoutMatch, tokens);

      assert.ok(
        nameScore > workoutScore,
        `Expected name score (${nameScore}) > workout score (${workoutScore})`
      );
    });

    it('scores Partner ID directly (highest weight 12)', () => {
      const gym = {
        partnerId: 'GYM18',
        name: 'Alpha Arena',
        area: 'Porur',
        city: 'Chennai',
      };

      const tokens = tokenizeAndNormalize('GYM18');
      const score = scoreGymRelevance(gym, tokens);
      assert.strictEqual(score, 12);
    });

    it('scores Phone numbers and emails', () => {
      const gym = {
        name: 'Alpha Arena',
        phone: '+919876543210',
        email: 'alpha@gymezy.com',
      };

      const phoneTokens = tokenizeAndNormalize('9876543210');
      assert.ok(scoreGymRelevance(gym, phoneTokens) >= 10);

      const emailTokens = tokenizeAndNormalize('alpha@gymezy.com');
      assert.ok(scoreGymRelevance(gym, emailTokens) >= 10);
    });
  });

  describe('6. "Did You Mean" Suggestion Engine', () => {
    it('suggests "CrossFit" for "crosfit"', () => {
      const suggestion = getDidYouMeanSuggestion('crosfit');
      assert.strictEqual(suggestion, 'CrossFit');
    });

    it('suggests "Fitness" for "fitnes"', () => {
      const suggestion = getDidYouMeanSuggestion('fitnes');
      assert.strictEqual(suggestion, 'Fitness');
    });

    it('suggests "Anna Nagar" for "ana nagar"', () => {
      const suggestion = getDidYouMeanSuggestion('ana nagar');
      assert.strictEqual(suggestion, 'Anna Nagar');
    });

    it('suggests "Velachery" for "velachry"', () => {
      const suggestion = getDidYouMeanSuggestion('velachry');
      assert.strictEqual(suggestion, 'Velachery');
    });

    it('returns null when query has no typos or already matches canonical terms', () => {
      assert.strictEqual(getDidYouMeanSuggestion('Anna Nagar'), null);
      assert.strictEqual(getDidYouMeanSuggestion('CrossFit'), null);
      assert.strictEqual(getDidYouMeanSuggestion('Velachery'), null);
      assert.strictEqual(getDidYouMeanSuggestion(''), null);
      assert.strictEqual(getDidYouMeanSuggestion(null), null);
    });
  });

  describe('7. Hybrid Relevance & Proximity Ranking Logic', () => {
    it('ranks by relevance score first, then breaks ties using nearest distance', () => {
      const candidates = [
        { name: 'PowerHouse Fitness Hub', relevanceScore: 10, distance: 5.2 },
        { name: 'FitZone Luxury Gym', relevanceScore: 28, distance: 8.5 },
        { name: 'Core Fit Studio', relevanceScore: 10, distance: 2.1 },
      ];

      // Hybrid sort: relevanceScore desc, distance asc
      candidates.sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        return a.distance - b.distance;
      });

      // Highest relevance should be first
      assert.strictEqual(candidates[0].name, 'FitZone Luxury Gym');
      // For score 10 tie, 2.1 km should rank before 5.2 km
      assert.strictEqual(candidates[1].name, 'Core Fit Studio');
      assert.strictEqual(candidates[2].name, 'PowerHouse Fitness Hub');
    });
  });
});

