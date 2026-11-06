import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeRegex,
  getSearchTerm,
  buildRegexSearchQuery,
  parsePagination,
  parseDateRangeFilter,
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

  describe('parseDateRangeFilter', () => {
    // Anchor reference date: Friday, 6 Nov 2026 15:30:00
    const refDate = new Date('2026-11-06T15:30:00.000Z');

    it('returns null for empty, all, or all-time range', () => {
      assert.strictEqual(parseDateRangeFilter({}, refDate), null);
      assert.strictEqual(parseDateRangeFilter({ range: 'All Time' }, refDate), null);
      assert.strictEqual(parseDateRangeFilter({ range: 'all' }, refDate), null);
      assert.strictEqual(parseDateRangeFilter(null, refDate), null);
    });

    it('calculates Today boundaries starting at 00:00:00 and ending at 23:59:59', () => {
      const filter = parseDateRangeFilter({ range: 'Today' }, refDate);
      assert.ok(filter && filter.start && filter.end);
      assert.strictEqual(filter.label, 'Today');
      assert.strictEqual(filter.start.getDate(), refDate.getDate());
      assert.strictEqual(filter.start.getHours(), 0);
      assert.strictEqual(filter.start.getMinutes(), 0);
      assert.strictEqual(filter.end.getHours(), 23);
      assert.strictEqual(filter.end.getMinutes(), 59);
    });

    it('calculates Yesterday boundaries correctly', () => {
      const filter = parseDateRangeFilter({ range: 'Yesterday' }, refDate);
      assert.ok(filter && filter.start && filter.end);
      assert.strictEqual(filter.label, 'Yesterday');
      assert.strictEqual(filter.start.getDate(), refDate.getDate() - 1);
      assert.strictEqual(filter.start.getHours(), 0);
      assert.strictEqual(filter.end.getHours(), 23);
    });

    it('calculates This Week boundaries from Monday', () => {
      const filter = parseDateRangeFilter({ range: 'This Week' }, refDate);
      assert.ok(filter && filter.start && filter.end);
      assert.strictEqual(filter.label, 'This Week');
      // 6 Nov 2026 is Friday; Monday was 2 Nov 2026
      assert.strictEqual(filter.start.getDate(), 2);
      assert.strictEqual(filter.start.getHours(), 0);
      assert.strictEqual(filter.end.getHours(), 23);
    });

    it('calculates This Month boundaries from 1st of month', () => {
      const filter = parseDateRangeFilter({ range: 'This Month' }, refDate);
      assert.ok(filter && filter.start && filter.end);
      assert.strictEqual(filter.label, 'This Month');
      assert.strictEqual(filter.start.getDate(), 1);
      assert.strictEqual(filter.start.getMonth(), 10); // November (0-indexed: 10)
      assert.strictEqual(filter.start.getHours(), 0);
      assert.strictEqual(filter.end.getMonth(), 10);
      assert.strictEqual(filter.end.getDate(), 30); // November has 30 days
      assert.strictEqual(filter.end.getHours(), 23);
    });

    it('handles explicit startDate and endDate params for custom range', () => {
      const filter = parseDateRangeFilter({
        startDate: '2026-10-05T10:00:00.000Z',
        endDate: '2026-10-20T10:00:00.000Z',
      }, refDate);
      assert.ok(filter && filter.start && filter.end);
      assert.strictEqual(filter.label, 'Custom Range');
      assert.strictEqual(filter.start.getMonth(), 9); // October
      assert.strictEqual(filter.end.getMonth(), 9);
      assert.strictEqual(filter.start.getDate(), 5);
      assert.strictEqual(filter.end.getDate(), 20);
      assert.strictEqual(filter.start.getHours(), 0);
      assert.strictEqual(filter.end.getHours(), 23);
    });

    it('handles formatted custom range string "01 Nov 2026 - 15 Nov 2026"', () => {
      const filter = parseDateRangeFilter({
        range: '01 Nov 2026 - 15 Nov 2026',
      }, refDate);
      assert.ok(filter && filter.start && filter.end);
      assert.strictEqual(filter.start.getDate(), 1);
      assert.strictEqual(filter.end.getDate(), 15);
      assert.strictEqual(filter.start.getMonth(), 10);
      assert.strictEqual(filter.end.getMonth(), 10);
    });

    it('supports filterType parameter as used by Super Admin dashboard', () => {
      const todayFilter = parseDateRangeFilter({ filterType: 'today' }, refDate);
      assert.ok(todayFilter && todayFilter.start);
      assert.strictEqual(todayFilter.label, 'Today');
      assert.strictEqual(todayFilter.start.getDate(), refDate.getDate());

      const weekFilter = parseDateRangeFilter({ filterType: 'week' }, refDate);
      assert.ok(weekFilter && weekFilter.start);
      assert.strictEqual(weekFilter.label, 'This Week');

      const monthFilter = parseDateRangeFilter({ filterType: 'month' }, refDate);
      assert.ok(monthFilter && monthFilter.start);
      assert.strictEqual(monthFilter.label, 'This Month');
      assert.strictEqual(monthFilter.start.getDate(), 1);

      const customFilter = parseDateRangeFilter({
        filterType: 'custom',
        startDate: '2026-10-05T10:00:00.000Z',
        endDate: '2026-10-20T10:00:00.000Z',
      }, refDate);
      assert.ok(customFilter && customFilter.start);
      assert.strictEqual(customFilter.label, 'Custom Range');
    });
  });
});

