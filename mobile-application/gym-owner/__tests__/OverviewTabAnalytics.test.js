import {
  WEEKLY_CHECKINS,
  PEAK_HOURS,
  PLAN_STATS,
} from '../src/pages/tabs/OverviewTab';

describe('OverviewTab Merged Analytics Data & Structures (SSOT)', () => {
  test('WEEKLY_CHECKINS contains all 7 days with valid footfall data', () => {
    expect(Array.isArray(WEEKLY_CHECKINS)).toBe(true);
    expect(WEEKLY_CHECKINS.length).toBe(7);

    const days = WEEKLY_CHECKINS.map((w) => w.day);
    expect(days).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

    WEEKLY_CHECKINS.forEach((item) => {
      expect(typeof item.count).toBe('number');
      expect(item.count).toBeGreaterThan(0);
      expect(item.heightPct).toBeGreaterThan(0);
      expect(item.heightPct).toBeLessThanOrEqual(100);
    });
  });

  test('PEAK_HOURS provides breakdown for morning, afternoon, and evening slots', () => {
    expect(Array.isArray(PEAK_HOURS)).toBe(true);
    expect(PEAK_HOURS.length).toBe(3);

    const labels = PEAK_HOURS.map((p) => p.label);
    expect(labels).toContain('Morning Rush');
    expect(labels).toContain('Afternoon Hours');
    expect(labels).toContain('Evening Prime');

    PEAK_HOURS.forEach((slot) => {
      expect(slot.time).toBeTruthy();
      expect(slot.occupancy).toBeTruthy();
      expect(['Peak', 'Moderate', 'Max Rush']).toContain(slot.status);
    });
  });

  test('PLAN_STATS defines proportions and colors for primary membership tiers', () => {
    expect(Array.isArray(PLAN_STATS)).toBe(true);
    expect(PLAN_STATS.length).toBeGreaterThan(0);

    const names = PLAN_STATS.map((p) => p.name);
    expect(names).toContain('Annual VIP Pass');
    expect(names).toContain('Quarterly Pro');
    expect(names).toContain('Monthly Standard');

    PLAN_STATS.forEach((plan) => {
      expect(typeof plan.count).toBe('number');
      expect(typeof plan.pct).toBe('string');
      expect(plan.pct.endsWith('%')).toBe(true);
      expect(plan.color).toBeTruthy();
    });
  });
});

