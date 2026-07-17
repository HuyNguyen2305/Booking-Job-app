import { describe, it, expect } from '@jest/globals';
import { parseTimestampWithOffset } from '#utils/date.util';

describe('DateUtil.parseTimestampWithOffset', () => {
  it('returns a valid DateTime for a timestamp with a Z suffix', () => {
    const dt = parseTimestampWithOffset('2026-07-10T09:00:00Z');
    expect(dt).not.toBeNull();
    expect(dt.isValid).toBe(true);
  });

  it('returns a valid DateTime for a timestamp with an explicit +hh:mm offset', () => {
    const dt = parseTimestampWithOffset('2026-07-10T09:00:00+07:00');
    expect(dt).not.toBeNull();
    expect(dt.isValid).toBe(true);
  });

  it('returns a valid DateTime for a timestamp with a lowercase z suffix', () => {
    const dt = parseTimestampWithOffset('2026-07-10T09:00:00z');
    expect(dt).not.toBeNull();
    expect(dt.isValid).toBe(true);
  });

  it('returns null when the offset is missing', () => {
    expect(parseTimestampWithOffset('2026-07-10T09:00:00')).toBeNull();
  });

  it('returns null for a structurally invalid string', () => {
    expect(parseTimestampWithOffset('not-a-date')).toBeNull();
  });

  it('returns null for a non-string value', () => {
    expect(parseTimestampWithOffset(undefined)).toBeNull();
    expect(parseTimestampWithOffset(null)).toBeNull();
    expect(parseTimestampWithOffset(12345)).toBeNull();
  });
});
