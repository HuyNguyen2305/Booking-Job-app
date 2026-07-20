/**
 * Sweep-line over per-worker busy intervals: a moment is "available" iff fewer than
 * `workerIds.length` of them are simultaneously busy there (i.e. at least one worker is
 * free), never "unavailable" only because one specific worker is booked. Adjacent
 * available instants are merged into windows and filtered to `minDurationMinutes`, since a
 * gap too short to fit the requested booking isn't useful to return.
 */
export function computeAvailableSlots({ windowStart, windowEnd, workerIds, bookings, minDurationMinutes }) {
  const totalWorkers = workerIds.length;
  if (totalWorkers === 0 || windowStart >= windowEnd) return [];

  const events = [];
  for (const booking of bookings) {
    const start = booking.start_time < windowStart ? windowStart : booking.start_time;
    const end = booking.end_time > windowEnd ? windowEnd : booking.end_time;
    if (start >= end) continue;
    // Process an end before a start at the same instant, so a worker's booking that ends
    // exactly when another begins doesn't create a phantom zero-width "busy" tick between them.
    events.push({ time: start, delta: 1 });
    events.push({ time: end, delta: -1 });
  }
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);

  const rawWindows = [];
  let cursor = windowStart;
  let busy = 0;
  for (const event of events) {
    if (event.time > cursor && busy < totalWorkers) {
      rawWindows.push({ start: cursor, end: event.time });
    }
    cursor = event.time;
    busy += event.delta;
  }
  if (cursor < windowEnd && busy < totalWorkers) {
    rawWindows.push({ start: cursor, end: windowEnd });
  }

  const merged = [];
  for (const window of rawWindows) {
    const last = merged[merged.length - 1];
    if (last && last.end.getTime() === window.start.getTime()) {
      last.end = window.end;
    } else {
      merged.push({ ...window });
    }
  }

  const minDurationMs = minDurationMinutes * 60 * 1000;
  return merged
    .filter((window) => window.end - window.start >= minDurationMs)
    .map((window) => ({ start_time: window.start.toISOString(), end_time: window.end.toISOString() }));
}
