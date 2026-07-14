import { describe, it, expect } from '@jest/globals';
import { toBusinessLocalWeekBoundsUtc } from '#utils/date.util';

describe('DateUtil.toBusinessLocalWeekBoundsUtc', () => {
  it('returns Monday 00:00 through the following Monday 00:00 for a mid-week reference (UTC+7)', () => {
    // 2026-07-15 is a Wednesday in Asia/Ho_Chi_Minh; that week's Monday is 2026-07-13.
    const { weekStart, weekEnd } = toBusinessLocalWeekBoundsUtc('2026-07-15T09:00:00+07:00', 'Asia/Ho_Chi_Minh');

    expect(weekStart.toISOString()).toBe('2026-07-12T17:00:00.000Z');
    expect(weekEnd.toISOString()).toBe('2026-07-19T17:00:00.000Z');
  });

  it('anchors to the same week when the reference is already Monday 00:00', () => {
    const { weekStart } = toBusinessLocalWeekBoundsUtc('2026-07-13T00:00:00+07:00', 'Asia/Ho_Chi_Minh');
    expect(weekStart.toISOString()).toBe('2026-07-12T17:00:00.000Z');
  });

  it('does not roll into the next week when the reference is Sunday (end of the same week)', () => {
    // 2026-07-19 is Sunday; still belongs to the week that started Monday 2026-07-13.
    const { weekStart, weekEnd } = toBusinessLocalWeekBoundsUtc('2026-07-19T09:00:00+07:00', 'Asia/Ho_Chi_Minh');
    expect(weekStart.toISOString()).toBe('2026-07-12T17:00:00.000Z');
    expect(weekEnd.toISOString()).toBe('2026-07-19T17:00:00.000Z');
  });

  it('produces exactly a 7-day window', () => {
    const { weekStart, weekEnd } = toBusinessLocalWeekBoundsUtc('2026-07-15T09:00:00+07:00', 'Asia/Ho_Chi_Minh');
    expect(weekEnd.getTime() - weekStart.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
