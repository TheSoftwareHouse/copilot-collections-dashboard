export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const PREMIUM_REQUESTS_PER_SEAT = 300;

/** Maximum length for error messages stored in job_execution records. */
export const ERROR_MESSAGE_MAX_LENGTH = 2000;

/** Threshold (in ms) after which a running job is considered stale (2 hours). */
export const STALE_JOB_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/** Base cost per active Copilot seat per month (USD). */
export const SEAT_BASE_COST_USD = 19;
