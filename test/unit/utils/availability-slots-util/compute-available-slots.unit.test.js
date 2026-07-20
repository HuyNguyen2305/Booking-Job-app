import { describe, it, expect } from '@jest/globals';
import { computeAvailableSlots } from '#utils/availability-slots.util';

const windowStart = new Date('2026-07-21T02:00:00.000Z'); // 09:00 +07:00
const windowEnd = new Date('2026-07-21T10:00:00.000Z'); // 17:00 +07:00

function iso(hourUtc) {
  return new Date(`2026-07-21T${String(hourUtc).padStart(2, '0')}:00:00.000Z`);
}

describe('computeAvailableSlots', () => {
  it('returns [] when there are no active workers', () => {
    const result = computeAvailableSlots({
      windowStart,
      windowEnd,
      workerIds: [],
      bookings: [],
      minDurationMinutes: 30,
    });
    expect(result).toEqual([]);
  });

  it('returns [] when the window is empty (start >= end)', () => {
    const result = computeAvailableSlots({
      windowStart: windowEnd,
      windowEnd: windowStart,
      workerIds: [1],
      bookings: [],
      minDurationMinutes: 30,
    });
    expect(result).toEqual([]);
  });

  it('returns the whole window as one slot when the single worker has no bookings', () => {
    const result = computeAvailableSlots({
      windowStart,
      windowEnd,
      workerIds: [1],
      bookings: [],
      minDurationMinutes: 30,
    });
    expect(result).toEqual([{ start_time: windowStart.toISOString(), end_time: windowEnd.toISOString() }]);
  });

  it('returns [] when the single worker is booked for the entire window', () => {
    const bookings = [{ start_time: windowStart, end_time: windowEnd }];
    const result = computeAvailableSlots({ windowStart, windowEnd, workerIds: [1], bookings, minDurationMinutes: 30 });
    expect(result).toEqual([]);
  });

  it('stays available all day when only one of two workers is booked the entire window', () => {
    const bookings = [{ start_time: windowStart, end_time: windowEnd }]; // worker 1 only
    const result = computeAvailableSlots({
      windowStart,
      windowEnd,
      workerIds: [1, 2],
      bookings,
      minDurationMinutes: 30,
    });
    expect(result).toEqual([{ start_time: windowStart.toISOString(), end_time: windowEnd.toISOString() }]);
  });

  it('marks a sub-range unavailable only where every worker is simultaneously busy', () => {
    const bookings = [
      { start_time: iso(2), end_time: iso(4) }, // worker 1, 09:00-11:00
      { start_time: iso(2), end_time: iso(4) }, // worker 2, 09:00-11:00
    ];
    const result = computeAvailableSlots({
      windowStart,
      windowEnd,
      workerIds: [1, 2],
      bookings,
      minDurationMinutes: 30,
    });
    expect(result).toEqual([{ start_time: iso(4).toISOString(), end_time: windowEnd.toISOString() }]);
  });

  it('merges consecutive available sub-windows split by non-overlapping single-worker bookings', () => {
    // Worker 1 busy 10:00-11:00, worker 2 busy 11:00-12:00 — at no instant are both busy,
    // so the whole window must come back as ONE merged slot, not four fragments.
    const bookings = [
      { start_time: iso(3), end_time: iso(4) },
      { start_time: iso(4), end_time: iso(5) },
    ];
    const result = computeAvailableSlots({
      windowStart,
      windowEnd,
      workerIds: [1, 2],
      bookings,
      minDurationMinutes: 30,
    });
    expect(result).toEqual([{ start_time: windowStart.toISOString(), end_time: windowEnd.toISOString() }]);
  });

  it('filters out a free gap shorter than minDurationMinutes', () => {
    // Free gap is only 09:00-09:10 (10 minutes) before the worker's booking starts.
    const bookingStart = new Date('2026-07-21T02:10:00.000Z');
    const bookings = [{ start_time: bookingStart, end_time: windowEnd }];
    const result = computeAvailableSlots({ windowStart, windowEnd, workerIds: [1], bookings, minDurationMinutes: 30 });
    expect(result).toEqual([]);
  });

  it('clips a booking that starts before windowStart or ends after windowEnd', () => {
    const bookings = [{ start_time: new Date('2026-07-20T00:00:00.000Z'), end_time: iso(4) }]; // starts a day earlier
    const result = computeAvailableSlots({ windowStart, windowEnd, workerIds: [1], bookings, minDurationMinutes: 30 });
    expect(result).toEqual([{ start_time: iso(4).toISOString(), end_time: windowEnd.toISOString() }]);
  });

  it("does not create a phantom gap when one worker's booking ends exactly as another's begins", () => {
    const bookings = [
      { start_time: windowStart, end_time: iso(4) }, // worker 1 busy 09:00-11:00
      { start_time: iso(4), end_time: windowEnd }, // worker 2 busy 11:00-17:00
    ];
    // Both workers busy back-to-back covers the whole day, but never simultaneously —
    // still, with only these two workers, at every instant exactly one is busy and the
    // other free, so the whole window is available end to end.
    const result = computeAvailableSlots({
      windowStart,
      windowEnd,
      workerIds: [1, 2],
      bookings,
      minDurationMinutes: 30,
    });
    expect(result).toEqual([{ start_time: windowStart.toISOString(), end_time: windowEnd.toISOString() }]);
  });
});
