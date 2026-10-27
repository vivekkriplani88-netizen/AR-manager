import { daysBetween } from './dates';
import { invoicePositions, type Bucket } from './positions';
import type { ArData, Customer, Invoice, Paise } from './types';

export type InvoiceStatusName = 'Paid' | 'Due' | 'Overdue' | 'Cancelled';

export interface InvoiceRow {
  invoice: Invoice;
  customer: Customer;
  status: InvoiceStatusName;
  received: Paise;
  credited: Paise;
  outstanding: Paise;
  daysPastDue: number;
  isPartPaid: boolean;
  bucket: Bucket | null;
}

export interface InvoiceTotals { count: number; cancelled: number; total: Paise; received: Paise; credited: Paise; outstanding: Paise }

/**
 * Every invoice dated on or before asOf, for the invoice list: live invoices with their R11 position,
 * and cancelled ones (R8) with the status Cancelled and no amounts.
 */
export function invoiceRows(data: ArData, asOf: string): InvoiceRow[] {
  const customers = new Map(data.customers.map((c) => [c.id, c]));
  const live: InvoiceRow[] = invoicePositions(data, asOf).map((p) => ({
    invoice: p.invoice, customer: customers.get(p.invoice.customerId)!, status: p.status,
    received: p.received, credited: p.credited, outstanding: p.outstanding,
    daysPastDue: p.daysPastDue, isPartPaid: p.isPartPaid, bucket: p.bucket,
  }));
  const cancelled: InvoiceRow[] = data.invoices
    .filter((i) => i.isCancelled && i.invoiceDate <= asOf)
    .map((i) => ({
      invoice: i, customer: customers.get(i.customerId)!, status: 'Cancelled',
      received: 0, credited: 0, outstanding: 0, daysPastDue: daysBetween(i.dueDate, asOf), isPartPaid: false, bucket: null,
    }));
  return [...live, ...cancelled];
}

/** The totals row for a list of invoices. Cancelled invoices are counted separately and left out of every amount. */
export function invoiceTotals(rows: InvoiceRow[]): InvoiceTotals {
  const t: InvoiceTotals = { count: 0, cancelled: 0, total: 0, received: 0, credited: 0, outstanding: 0 };
  for (const r of rows) {
    if (r.status === 'Cancelled') { t.cancelled += 1; continue; }
    t.count += 1;
    t.total += r.invoice.total;
    t.received += r.received;
    t.credited += r.credited;
    t.outstanding += r.outstanding;
  }
  return t;
}
