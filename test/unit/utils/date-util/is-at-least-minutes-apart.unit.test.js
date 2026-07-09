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
});
