import { describe, expect, it } from 'vitest';
import { isValidDate, parseAsOf, readAsOf, todayInIndia, withAsOf } from '../lib/asof';

describe('todayInIndia', () => {
  it('rolls over at midnight IST, which is 18:30 UTC the day before', () => {
    expect(todayInIndia(new Date('2026-09-17T18:29:59Z'))).toBe('2026-09-17');
    expect(todayInIndia(new Date('2026-09-17T18:30:00Z'))).toBe('2026-09-18');
  });

  it('is already tomorrow between midnight and 05:30 IST, when UTC is still today', () => {
    expect(todayInIndia(new Date('2026-09-17T22:00:00Z'))).toBe('2026-09-18'); // 03:30 IST
  });

  it('returns YYYY-MM-DD', () => {
    expect(todayInIndia(new Date('2026-01-05T06:00:00Z'))).toBe('2026-01-05');
  });
});

describe('isValidDate', () => {
  it('accepts real calendar dates', () => {
    expect(isValidDate('2026-08-31')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
  });

  it('rejects dates that do not exist or are written differently', () => {
    for (const bad of ['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10', '2026-8-31', '31-08-2026', ' 2026-08-31', '2026-08-31x', '']) {
      expect(isValidDate(bad), bad).toBe(false);
    }
  });
});

describe('parseAsOf', () => {
  const now = new Date('2026-09-17T20:00:00Z'); // 18-Sep-2026, 01:30 IST

  it('uses a valid ?asof=', () => {
    expect(parseAsOf('2026-08-31', now)).toBe('2026-08-31');
  });

  it('defaults to today in India when missing', () => {
    expect(parseAsOf(undefined, now)).toBe('2026-09-18');
    expect(parseAsOf(null, now)).toBe('2026-09-18');
    expect(parseAsOf('', now)).toBe('2026-09-18');
  });

  it('falls back to today when the value is not a valid date', () => {
    expect(parseAsOf('2026-02-30', now)).toBe('2026-09-18');
    expect(parseAsOf('yesterday', now)).toBe('2026-09-18');
  });

  it('takes the first value when ?asof= is repeated', () => {
    expect(parseAsOf(['2026-08-31', '2026-09-06'], now)).toBe('2026-08-31');
  });
});

describe('readAsOf', () => {
  it('reads asof from a page’s searchParams', async () => {
    expect(await readAsOf(Promise.resolve({ asof: '2026-08-31', status: 'Overdue' }))).toBe('2026-08-31');
  });
});

describe('withAsOf', () => {
  it('adds ?asof= to a link', () => {
    expect(withAsOf('/customers', '2026-08-31')).toBe('/customers?asof=2026-08-31');
  });

  it('keeps the link’s other parameters and fragment', () => {
    expect(withAsOf('/invoices?status=Overdue', '2026-08-31')).toBe('/invoices?status=Overdue&asof=2026-08-31');
    expect(withAsOf('/customers/5#notes', '2026-08-31')).toBe('/customers/5?asof=2026-08-31#notes');
  });

  it('replaces an existing asof rather than adding a second one', () => {
    expect(withAsOf('/invoices?asof=2026-01-01&status=Due', '2026-08-31')).toBe('/invoices?asof=2026-08-31&status=Due');
  });

  it('leaves the link alone when there is no as-at date', () => {
    expect(withAsOf('/customers', null)).toBe('/customers');
  });
});
