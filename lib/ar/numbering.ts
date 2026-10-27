import type { ArData } from './types';

export type Series = 'invoice' | 'creditNote' | 'receipt';

const SERIES: Record<Series, { prefix: (fy: string) => string; digits: number; numbers: (d: ArData) => string[] }> = {
  invoice: { prefix: (fy) => `BWA/${fy}/`, digits: 4, numbers: (d) => d.invoices.map((i) => i.invoiceNo) },
  creditNote: { prefix: (fy) => `BWA/CN/${fy}/`, digits: 3, numbers: (d) => d.creditNotes.map((c) => c.creditNoteNo) },
  receipt: { prefix: (fy) => `RCT/${fy}/`, digits: 4, numbers: (d) => d.receipts.map((r) => r.receiptNo) },
};

/** R4: the Indian financial year (April to March) of a date, e.g. '2026-03-31' → '25-26'. */
export function fyLabel(date: string): string {
  const [y, m] = date.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  const yy = (n: number) => String(n % 100).padStart(2, '0');
  return `${yy(start)}-${yy(start + 1)}`;
}

/**
 * R4: the next number in a series for a document dated `date`. One more than the highest number
 * already used in that financial year, cancelled invoices included, so no number is reused.
 */
export function nextNumber(series: Series, data: ArData, date: string): string {
  const { prefix, digits, numbers } = SERIES[series];
  const p = prefix(fyLabel(date));
  let max = 0;
  for (const no of numbers(data)) {
    const rest = no.startsWith(p) ? no.slice(p.length) : '';
    if (/^\d+$/.test(rest)) max = Math.max(max, Number(rest));
  }
  return p + String(max + 1).padStart(digits, '0');
}
