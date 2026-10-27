import { addDays } from './dates';
import { balanceByDocuments, customerPositions, type Bucket } from './positions';
import type { ArData, Customer, Paise } from './types';

export type StatementLineType = 'Invoice' | 'Credit note' | 'Payment' | 'TDS';

export interface StatementLine {
  date: string;
  type: StatementLineType;
  documentNo: string;
  description: string;
  debit: Paise;
  credit: Paise;
  balance: Paise; // running balance after this line; positive is Dr
}

export interface Statement {
  customer: Customer;
  from: string;
  to: string;
  opening: Paise;
  lines: StatementLine[];
  closing: Paise;
  buckets: Record<Bucket, Paise>; // the closing balance by ageing bucket, as at `to`
  unapplied: Paise;
}

// R15: on the same date, invoices come first, then credit notes, receipts and TDS lines.
const ORDER: Record<StatementLineType, number> = { Invoice: 0, 'Credit note': 1, Payment: 2, TDS: 3 };

/** R15: statement of account for one customer from `from` to `to`, both inclusive. */
export function statement(data: ArData, customerId: number, from: string, to: string): Statement {
  if (from > to) throw new Error(`Statement period starts (${from}) after it ends (${to}).`);
  const customer = data.customers.find((c) => c.id === customerId);
  if (!customer) throw new Error(`Unknown customer ${customerId}.`);

  const inPeriod = (date: string) => date >= from && date <= to;
  const invoices = data.invoices.filter((i) => i.customerId === customerId && !i.isCancelled);
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));
  const rows: Omit<StatementLine, 'balance'>[] = [];

  for (const i of invoices) {
    if (inPeriod(i.invoiceDate)) {
      rows.push({ date: i.invoiceDate, type: 'Invoice', documentNo: i.invoiceNo, description: i.description, debit: i.total, credit: 0 });
    }
  }
  for (const c of data.creditNotes) {
    const invoice = invoiceById.get(c.invoiceId);
    if (invoice && inPeriod(c.creditNoteDate)) {
      rows.push({
        date: c.creditNoteDate, type: 'Credit note', documentNo: c.creditNoteNo,
        description: `Credit note against ${invoice.invoiceNo}: ${c.reason}`, debit: 0, credit: c.total,
      });
    }
  }
  for (const r of data.receipts) {
    if (r.customerId !== customerId || !inPeriod(r.receiptDate)) continue;
    rows.push({ date: r.receiptDate, type: 'Payment', documentNo: r.receiptNo, description: 'Payment received', debit: 0, credit: r.bankAmount });
    if (r.tdsAmount > 0) {
      rows.push({ date: r.receiptDate, type: 'TDS', documentNo: r.receiptNo, description: 'TDS deducted by you', debit: 0, credit: r.tdsAmount });
    }
  }

  rows.sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1)
    : a.type !== b.type ? ORDER[a.type] - ORDER[b.type]
    : a.documentNo < b.documentNo ? -1 : a.documentNo > b.documentNo ? 1 : 0,
  );

  const opening = balanceByDocuments(data, customerId, addDays(from, -1));
  let balance = opening;
  const lines = rows.map((row) => {
    balance += row.debit - row.credit;
    return { ...row, balance };
  });

  const position = customerPositions(data, to).find((p) => p.customer.id === customerId)!;
  return { customer, from, to, opening, lines, closing: balance, buckets: position.buckets, unapplied: position.unapplied };
}
