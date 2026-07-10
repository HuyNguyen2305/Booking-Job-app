export function rankAvailableWorkers(rows) {
  return rows
    .filter((row) => !row.has_overlap)
    .sort((a, b) => a.booked_hours - b.booked_hours)
    .map((row) => ({ worker_id: row.worker_id, booked_hours_that_day: Number(row.booked_hours) }));
}
