// Dates are 'YYYY-MM-DD' strings throughout. They compare correctly as text, and all arithmetic
// goes through Date.UTC, so results never depend on the machine's time zone (section 4.11).

const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from one 'YYYY-MM-DD' date to another. Never uses local time. */
export function daysBetween(from: string, to: string): number {
  return (toUtc(to) - toUtc(from)) / DAY_MS;
}

/** The date `days` calendar days after `date` (before it, when negative). */
export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}
