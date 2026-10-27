// The as-at date (R10). Every page reads ?asof=YYYY-MM-DD; when it is missing or invalid, today in India.
// Plain functions, so server pages and browser components share them.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Today's date in Asia/Kolkata as 'YYYY-MM-DD'. Vercel runs in UTC, where "today" is still
 * yesterday until 05:30 IST, so the server's own date is never used (section 4.10).
 */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

/** True for a real calendar date written as 'YYYY-MM-DD' (so not '2026-02-30'). */
export function isValidDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** The as-at date from a ?asof= value, or today in India when it is missing or invalid. */
export function parseAsOf(value: string | string[] | null | undefined, now: Date = new Date()): string {
  const v = Array.isArray(value) ? value[0] : value;
  return v && isValidDate(v) ? v : todayInIndia(now);
}

/**
 * The ?asof= to carry on links: the URL's own value when valid, else null. Not the default,
 * so a page opened without one keeps following today.
 */
export function asOfParam(value: string | string[] | null | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v && isValidDate(v) ? v : null;
}

/** Adds ?asof= to a link, keeping its other parameters and #fragment. Unchanged when asOf is null. */
export function withAsOf(href: string, asOf: string | null): string {
  if (!asOf) return href;
  const [beforeHash, hash] = href.split('#', 2);
  const [path, query = ''] = beforeHash.split('?', 2);
  const params = new URLSearchParams(query);
  params.set('asof', asOf);
  return `${path}?${params.toString()}${hash === undefined ? '' : `#${hash}`}`;
}
