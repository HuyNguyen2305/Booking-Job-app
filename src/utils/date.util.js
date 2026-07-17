import { DateTime } from 'luxon';

export function isAtLeastMinutesApart(startTime, endTime, minutes) {
  const start = parseTimestampWithOffset(startTime);
  const end = parseTimestampWithOffset(endTime);
  if (!start || !end) return false;
  return end.diff(start, 'milliseconds').milliseconds >= minutes * 60 * 1000;
}

const OFFSET_SUFFIX_RE = /(Z|[+-]\d{2}:\d{2}|[+-]\d{4})$/i;

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

/**
 * UTC instant bounds of the local business-calendar week (Monday 00:00 through the
 * following Monday 00:00) containing `referenceISO`. Computed from luxon's ISO
 * `weekday` (1=Monday..7=Sunday, locale-independent) rather than `startOf('week')`,
 * which is locale-dependent and would silently shift the week start on some locales.
 */
export function toBusinessLocalWeekBoundsUtc(referenceISO, zone) {
  const referenceLocal = DateTime.fromISO(referenceISO, { setZone: true }).setZone(zone);
  const weekStart = referenceLocal.startOf('day').minus({ days: referenceLocal.weekday - 1 });
  return { weekStart: weekStart.toUTC().toJSDate(), weekEnd: weekStart.plus({ weeks: 1 }).toUTC().toJSDate() };
}
