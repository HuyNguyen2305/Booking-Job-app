import { DateTime } from 'luxon';

const ZONE = 'Asia/Ho_Chi_Minh';

function nextWeekday(isoWeekday, daysAhead) {
  let dt = DateTime.now().setZone(ZONE).plus({ days: daysAhead }).startOf('day');
  while (dt.weekday !== isoWeekday) dt = dt.plus({ days: 1 });
  return dt;
}

/**
 * ISO string (with UTC offset) for the next Tuesday relative to whenever the test
 * actually runs, at the given local hour:minute. Used instead of a hardcoded date so
 * tests stay valid indefinitely rather than silently going stale once PAST_BOOKING_TIME
 * catches up to a fixed date baked in at authoring time. `daysAhead` defaults to a full
 * week out so there's no edge-case flakiness right at "now".
 */
export function nextTuesdayAt(hour, minute = 0, daysAhead = 7) {
  return nextWeekday(2, daysAhead).set({ hour, minute, second: 0, millisecond: 0 }).toISO();
}

/** Same idea, but the next Saturday — for NON_WEEKDAY_BOOKING-style tests. */
export function nextSaturdayAt(hour, minute = 0, daysAhead = 7) {
  return nextWeekday(6, daysAhead).set({ hour, minute, second: 0, millisecond: 0 }).toISO();
}
