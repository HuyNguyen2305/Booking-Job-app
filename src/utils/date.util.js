import { DateTime } from 'luxon';

export function isAtLeastMinutesApart(startTime, endTime, minutes) {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return end - start >= minutes * 60 * 1000;
}

const OFFSET_SUFFIX_RE = /(Z|[+-]\d{2}:\d{2}|[+-]\d{4})$/;

/**
 * Returns a luxon DateTime if `value` is a syntactically valid ISO 8601 string
 * carrying an explicit UTC offset/Z; otherwise null. AJV's format:'date-time'
 * does not require an offset, so this is the sole enforcement of that rule.
 */
export function parseTimestampWithOffset(value) {
  if (typeof value !== 'string' || !OFFSET_SUFFIX_RE.test(value.trim())) return null;
  const dt = DateTime.fromISO(value, { setZone: true });
  return dt.isValid ? dt : null;
}

/** UTC instant bounds of the local business-calendar day containing `startISO`. */
export function toBusinessLocalDayBoundsUtc(startISO, zone) {
  const startLocal = DateTime.fromISO(startISO, { setZone: true }).setZone(zone);
  const dayStart = startLocal.startOf('day');
  return { dayStart: dayStart.toUTC().toJSDate(), dayEnd: dayStart.plus({ days: 1 }).toUTC().toJSDate() };
}
