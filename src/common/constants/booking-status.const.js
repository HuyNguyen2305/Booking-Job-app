export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const BOOKING_STATUS_VALUES = Object.values(BOOKING_STATUS);

// Bookings still open for further action (reschedule, confirm, etc.) — COMPLETED and
// CANCELLED are terminal. Only use this for reschedulability/transition-eligibility checks.
export const ACTIVE_BOOKING_STATUSES = [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED];

// Bookings that genuinely occupy a worker's time slot — everything except CANCELLED,
// since a COMPLETED job still happened and must count toward overlap/hours. Mirrors the
// `status <> 'CANCELLED'` predicate on the DB's no_overlapping_bookings EXCLUDE constraint;
// use this (not ACTIVE_BOOKING_STATUSES) for any overlap-detection or booked-hours query.
export const OCCUPIED_BOOKING_STATUSES = [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED];

// Source status -> allowed next statuses. Anything not listed (or listed with []) is terminal.
export const BOOKING_STATUS_TRANSITIONS = {
  [BOOKING_STATUS.PENDING]: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED],
  [BOOKING_STATUS.CONFIRMED]: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED],
  [BOOKING_STATUS.COMPLETED]: [],
  [BOOKING_STATUS.CANCELLED]: [],
};

export const MIN_BOOKING_DURATION_MINUTES = 30;
