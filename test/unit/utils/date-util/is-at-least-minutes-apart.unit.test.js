import { describe, it, expect } from '@jest/globals';
import { isAtLeastMinutesApart } from '#utils/date.util';

describe('DateUtil.isAtLeastMinutesApart', () => {
  it('returns true when the gap is exactly the required number of minutes', () => {
    const start = '2026-07-09T09:00:00.000Z';
    const end = '2026-07-09T09:30:00.000Z';
    expect(isAtLeastMinutesApart(start, end, 30)).toBe(true);
  });

  it('returns false when the gap is less than the required number of minutes', () => {
    const start = '2026-07-09T09:00:00.000Z';
    const end = '2026-07-09T09:29:59.000Z';
    expect(isAtLeastMinutesApart(start, end, 30)).toBe(false);
  });

  it('returns true when the gap is larger than the required number of minutes', () => {
    const start = '2026-07-09T09:00:00.000Z';
    const end = '2026-07-09T11:00:00.000Z';
    expect(isAtLeastMinutesApart(start, end, 30)).toBe(true);
  });

  it('returns false for an offset-less timestamp instead of guessing the server timezone', () => {
    const start = '2026-07-09T09:00:00';
    const end = '2026-07-09T11:00:00';
    expect(isAtLeastMinutesApart(start, end, 30)).toBe(false);
  });

  it('returns false for a structurally invalid timestamp instead of relying on a NaN comparison', () => {
    expect(isAtLeastMinutesApart('not-a-date', '2026-07-09T11:00:00.000Z', 30)).toBe(false);
    expect(isAtLeastMinutesApart('2026-07-09T09:00:00.000Z', 'not-a-date', 30)).toBe(false);
  });

  it('accepts a lowercase z offset the same way as an uppercase one', () => {
    const start = '2026-07-09T09:00:00.000z';
    const end = '2026-07-09T09:30:00.000z';
    expect(isAtLeastMinutesApart(start, end, 30)).toBe(true);
  });
});
