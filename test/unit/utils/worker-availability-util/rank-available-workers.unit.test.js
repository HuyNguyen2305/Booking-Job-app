import { describe, it, expect } from '@jest/globals';
import { rankAvailableWorkers } from '#utils/worker-availability.util';

describe('WorkerAvailabilityUtil.rankAvailableWorkers', () => {
  it('filters out workers with has_overlap true', () => {
    const result = rankAvailableWorkers([
      { worker_id: 1, has_overlap: true, booked_hours: 0 },
      { worker_id: 2, has_overlap: false, booked_hours: 3 },
    ]);

    expect(result).toEqual([{ worker_id: 2, booked_hours_that_day: 3 }]);
  });

  it('sorts remaining workers ascending by booked_hours', () => {
    const result = rankAvailableWorkers([
      { worker_id: 1, has_overlap: false, booked_hours: 5 },
      { worker_id: 2, has_overlap: false, booked_hours: 1 },
      { worker_id: 3, has_overlap: false, booked_hours: 3 },
    ]);

    expect(result.map((r) => r.worker_id)).toEqual([2, 3, 1]);
  });

  it('coerces booked_hours to a Number in the output', () => {
    const result = rankAvailableWorkers([{ worker_id: 1, has_overlap: false, booked_hours: '2.5' }]);
    expect(result).toEqual([{ worker_id: 1, booked_hours_that_day: 2.5 }]);
  });

  it('returns an empty array when given no rows', () => {
    expect(rankAvailableWorkers([])).toEqual([]);
  });

  it('returns an empty array when every row has an overlap', () => {
    const result = rankAvailableWorkers([
      { worker_id: 1, has_overlap: true, booked_hours: 0 },
      { worker_id: 2, has_overlap: true, booked_hours: 2 },
    ]);
    expect(result).toEqual([]);
  });
});
