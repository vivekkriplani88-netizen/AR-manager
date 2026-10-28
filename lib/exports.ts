// The rows of each CSV export, built from the same lib/ar results as the screens.
import { BUCKETS, type Bucket, type Dashboard, type InvoiceRow, type InvoiceTotals, type Statement } from './ar';
import type { Cell } from './csv';
import { toPlainRupees } from './format';
import { SELLER } from './seller';

const BUCKET_HEADINGS: Record<Bucket, string> = {
  'Not due': 'Not due', '1-30': '1-30 days', '31-60': '31-60 days', '61-90': '61-90 days', '91-180': '91-180 days', 'Over 180': 'Over 180 days',
};

const amount = (paise: number): string => toPlainRupees(paise);
/** A balance as a plain number (positive is Dr), and its side in the next column. */
const balance = (paise: number): Cell[] => [amount(paise), paise > 0 ? 'Dr' : paise < 0 ? 'Cr' : ''];

/** R15 statement: heading, opening balance, lines with running balance, closing balance, ageing footer. */
export function statementCsvRows(s: Statement): Cell[][] {
  return [
    ['Statement of account', SELLER.name, `${SELLER.address}, ${SELLER.state}`],
    ['Customer', `${s.customer.code} ${s.customer.name}`, `${s.customer.city}, ${s.customer.state}`],
    ['Period', s.from, s.to],
    [],
    ['Date', 'Type', 'Document', 'Description', 'Debit', 'Credit', 'Balance', 'Dr/Cr'],
    [s.from, 'Opening balance', null, null, null, null, ...balance(s.opening)],
    ...s.lines.map((l): Cell[] => [
      l.date, l.type, l.documentNo, l.description,
      l.debit ? amount(l.debit) : null, l.credit ? amount(l.credit) : null, ...balance(l.balance),
    ]),
    [s.to, 'Closing balance', null, null, null, null, ...balance(s.closing)],
    [],
    ['Closing balance by ageing', 'Amount'],
    ...BUCKETS.map((b): Cell[] => [BUCKET_HEADINGS[b], amount(s.buckets[b])]),
    ['Less unapplied credit', amount(-s.unapplied)],
    ['Closing balance', ...balance(s.closing)],
  ];
}

/** The invoice list as filtered on screen, with its totals row. Cancelled invoices carry no amounts. */
export function invoiceCsvRows(rows: InvoiceRow[], totals: InvoiceTotals, asOf: string): Cell[][] {
  return [
    ['Invoices as at', asOf],
    [],
    ['Invoice number', 'Customer code', 'Customer', 'Invoice date', 'Due date', 'Total', 'Received', 'Credited', 'Outstanding', 'Status', 'Part-paid', 'Disputed', 'Days late'],
    ...rows.map((r): Cell[] => {
      const cancelled = r.status === 'Cancelled';
      return [
        r.invoice.invoiceNo, r.customer.code, r.customer.name, r.invoice.invoiceDate, r.invoice.dueDate,
        amount(r.invoice.total),
        cancelled ? null : amount(r.received), cancelled ? null : amount(r.credited), cancelled ? null : amount(r.outstanding),
        r.status, r.isPartPaid ? 'Yes' : 'No', r.invoice.isDisputed ? 'Yes' : 'No',
        r.status === 'Overdue' ? r.daysPastDue : null,
      ];
    }),
    [`Total of ${totals.count} invoices${totals.cancelled ? ` (${totals.cancelled} cancelled, not included)` : ''}`, null, null, null, null,
      amount(totals.total), amount(totals.received), amount(totals.credited), amount(totals.outstanding)],
  ];
}

/** R12 + R13: ageing by customer with unapplied credit in its own column, and a totals row. */
export function ageingCsvRows(d: Dashboard, asOf: string): Cell[][] {
  return [
    ['Ageing as at', asOf],
    [],
    ['Customer code', 'Customer', ...BUCKETS.map((b) => BUCKET_HEADINGS[b]), 'Outstanding', 'Unapplied credit', 'Net balance', 'Dr/Cr'],
    ...d.ageing.map((p): Cell[] => [
      p.customer.code, p.customer.name, ...BUCKETS.map((b) => amount(p.buckets[b])),
      amount(p.outstanding), amount(p.unapplied), ...balance(p.netBalance),
    ]),
    ['Total', null, ...BUCKETS.map((b) => amount(d.ageingTotals.buckets[b])),
      amount(d.ageingTotals.outstanding), amount(d.ageingTotals.unapplied), ...balance(d.ageingTotals.netBalance)],
  ];
}
