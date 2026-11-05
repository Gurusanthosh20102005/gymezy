import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeRegex,
  getSearchTerm,
  buildRegexSearchQuery,
  parsePagination,
} from '../src/utils/searchHelper.js';

describe('searchHelper Unit Tests (SSOT)', () => {
  describe('escapeRegex', () => {
    it('escapes special regex characters safely', () => {
      const dangerous = 'hello (world) [tier] +91*?^$';
      const escaped = escapeRegex(dangerous);
      assert.strictEqual(escaped, 'hello \\(world\\) \\[tier\\] \\+91\\*\\?\\^\\$');
      // Verify safe instantiation without syntax error
      const regex = new RegExp(escaped, 'i');
      assert.ok(regex.test('hello (world) [tier] +91*?^$'));
    });

    it('returns empty string for null, undefined, or empty inputs', () => {
      assert.strictEqual(escapeRegex(null), '');
      assert.strictEqual(escapeRegex(undefined), '');
      assert.strictEqual(escapeRegex(''), '');
    });
  });

  describe('getSearchTerm', () => {
    it('extracts canonical search param', () => {
      assert.strictEqual(getSearchTerm({ search: '  John Doe  ' }), 'John Doe');
    });

    it('falls back to q param when search is absent', () => {
      assert.strictEqual(getSearchTerm({ q: 'Trainer ' }), 'Trainer');
    });

    it('prioritizes search over q when both are present', () => {
      assert.strictEqual(getSearchTerm({ search: 'primary', q: 'fallback' }), 'primary');
    });

    it('returns empty string when neither is present or input is invalid', () => {
      assert.strictEqual(getSearchTerm({}), '');
      assert.strictEqual(getSearchTerm(null), '');
      assert.strictEqual(getSearchTerm({ filter: 'other' }), '');
    });
  });

  describe('buildRegexSearchQuery', () => {
    it('constructs MongoDB $or query across given fields with escaped regex', () => {
      const query = buildRegexSearchQuery('C++ Dev', ['name', 'title', 'skills']);
      assert.ok(query && query.$or);
      assert.strictEqual(query.$or.length, 3);
      assert.ok(query.$or[0].name instanceof RegExp);
      assert.ok(query.$or[0].name.test('C++ Developer'));
      assert.ok(!query.$or[0].name.test('Java Developer'));
    });

    it('returns null if search term is empty or fields array is empty', () => {
      assert.strictEqual(buildRegexSearchQuery('', ['name']), null);
      assert.strictEqual(buildRegexSearchQuery('   ', ['name']), null);
      assert.strictEqual(buildRegexSearchQuery('test', []), null);
      assert.strictEqual(buildRegexSearchQuery(null, ['name']), null);
    });
  });

  describe('parsePagination', () => {
    it('defaults to page 1 and default limit', () => {
      const p = parsePagination({}, 10, 50);
      assert.strictEqual(p.page, 1);
      assert.strictEqual(p.limit, 10);
      assert.strictEqual(p.skip, 0);
      assert.strictEqual(p.isFetchAll, false);
    });

    it('parses valid numeric query strings and enforces bounds', () => {
      const p = parsePagination({ page: '3', limit: '25' }, 10, 50);
      assert.strictEqual(p.page, 3);
      assert.strictEqual(p.limit, 25);
      assert.strictEqual(p.skip, 50);
    });

    it('caps limit at maxLimit', () => {
      const p = parsePagination({ page: '1', limit: '500' }, 10, 50);
      assert.strictEqual(p.limit, 50);
    });

    it('handles pageSize alias', () => {
      const p = parsePagination({ page: '2', pageSize: '15' });
      assert.strictEqual(p.page, 2);
      assert.strictEqual(p.limit, 15);
      assert.strictEqual(p.skip, 15);
    });

    it('detects all / 0 fetch-all mode', () => {
      const p1 = parsePagination({ limit: 'all' });
      assert.strictEqual(p1.isFetchAll, true);
      assert.strictEqual(p1.limit, 0);
      assert.strictEqual(p1.skip, 0);

      const p2 = parsePagination({ pageSize: '0' });
      assert.strictEqual(p2.isFetchAll, true);
      assert.strictEqual(p2.limit, 0);
    });
  });
});

