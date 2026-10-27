import { addDays } from './dates';
import { invoicePositions } from './positions';
import type { ArData } from './types';

/**
 * R17: days sales outstanding as at asOf, rounded to the nearest whole day.
 * Outstanding (before unapplied credit) ÷ net sales of the 90 days ending asOf × 90.
 * Returns null when there are no net sales in the window.
 */
export function dso(data: ArData, asOf: string): number | null {
  const start = addDays(asOf, -89);
  const inWindow = (date: string) => date >= start && date <= asOf;

  let sales = 0;
  for (const i of data.invoices) if (!i.isCancelled && inWindow(i.invoiceDate)) sales += i.total;
  for (const c of data.creditNotes) if (inWindow(c.creditNoteDate)) sales -= c.total;
  if (sales <= 0) return null;

  let outstanding = 0;
  for (const p of invoicePositions(data, asOf)) outstanding += p.outstanding;
  return Math.round((outstanding * 90) / sales);
}
