import { DAYS_ORDER } from '../src/pages/tabs/OverviewTab';

describe('OverviewTab Analytics Data & Structures (SSOT)', () => {
  test('DAYS_ORDER contains all 7 days in Monday-Sunday order', () => {
    expect(Array.isArray(DAYS_ORDER)).toBe(true);
    expect(DAYS_ORDER).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
});

