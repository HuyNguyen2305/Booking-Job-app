import { describe, it, expect } from '@jest/globals';
import { toBusinessLocalDayBoundsUtc } from '#utils/date.util';

describe('DateUtil.toBusinessLocalDayBoundsUtc', () => {
  it('returns the UTC instants bounding the local calendar day for a UTC+7 zone', () => {
    const { dayStart, dayEnd } = toBusinessLocalDayBoundsUtc('2026-07-14T09:00:00+07:00', 'Asia/Ho_Chi_Minh');

    expect(dayStart.toISOString()).toBe('2026-07-13T17:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-07-14T17:00:00.000Z');
  });

  it('anchors to the local day even when the input instant is given in a different offset', () => {
    // 2026-07-14T23:00:00Z is already 2026-07-15 local in UTC+7.
    const { dayStart, dayEnd } = toBusinessLocalDayBoundsUtc('2026-07-14T23:00:00Z', 'Asia/Ho_Chi_Minh');

    expect(dayStart.toISOString()).toBe('2026-07-14T17:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-07-15T17:00:00.000Z');
  });

  it('produces exactly a 24-hour window', () => {
    const { dayStart, dayEnd } = toBusinessLocalDayBoundsUtc('2026-07-14T09:00:00+07:00', 'Asia/Ho_Chi_Minh');
    expect(dayEnd.getTime() - dayStart.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
