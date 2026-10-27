import { daysBetween } from './dates';
import type { ArData, Customer, Invoice, Paise, Receipt } from './types';

export type Bucket = 'Not due' | '1-30' | '31-60' | '61-90' | '91-180' | 'Over 180';
export const BUCKETS: Bucket[] = ['Not due', '1-30', '31-60', '61-90', '91-180', 'Over 180'];

export interface InvoicePosition {
  invoice: Invoice;
  received: Paise;
  credited: Paise;
  outstanding: Paise;
  daysPastDue: number;
  status: 'Paid' | 'Due' | 'Overdue';
  isPartPaid: boolean;
  bucket: Bucket | null;
}

export interface ReceiptPosition {
  receipt: Receipt;
  settlement: Paise;
  allocated: Paise;
  unapplied: Paise;
}

export interface CustomerPosition {
  customer: Customer;
  buckets: Record<Bucket, Paise>;
  outstanding: Paise;
  unapplied: Paise;
  netBalance: Paise;
  overdue: Paise;
  overLimit: boolean;
}

export interface BalanceDifference {
  customerId: number;
  customerCode: string;
  netBalance: Paise;
  byDocuments: Paise;
}

export function bucketFor(daysPastDue: number): Bucket {
  if (daysPastDue <= 0) return 'Not due';
  if (daysPastDue <= 30) return '1-30';
  if (daysPastDue <= 60) return '31-60';
  if (daysPastDue <= 90) return '61-90';
  if (daysPastDue <= 180) return '91-180';
  return 'Over 180';
}

export function emptyBuckets(): Record<Bucket, Paise> {
  return { 'Not due': 0, '1-30': 0, '31-60': 0, '61-90': 0, '91-180': 0, 'Over 180': 0 };
}

/** R11 + R12: the position of every live invoice at the end of asOf ('YYYY-MM-DD'). */
export function invoicePositions(data: ArData, asOf: string): InvoicePosition[] {
  const received = new Map<number, Paise>();
  for (const a of data.allocations) {
    if (a.allocationDate <= asOf) received.set(a.invoiceId, (received.get(a.invoiceId) ?? 0) + a.amount);
  }
  const credited = new Map<number, Paise>();
  for (const c of data.creditNotes) {
    if (c.creditNoteDate <= asOf) credited.set(c.invoiceId, (credited.get(c.invoiceId) ?? 0) + c.total);
  }
  return data.invoices
    .filter((i) => !i.isCancelled && i.invoiceDate <= asOf)
    .map((i) => {
      const rec = received.get(i.id) ?? 0;
      const cred = credited.get(i.id) ?? 0;
      const outstanding = i.total - rec - cred;
      const daysPastDue = daysBetween(i.dueDate, asOf);
      return {
        invoice: i,
        received: rec,
        credited: cred,
        outstanding,
        daysPastDue,
        status: outstanding === 0 ? 'Paid' : daysPastDue >= 1 ? 'Overdue' : 'Due',
        isPartPaid: outstanding > 0 && rec + cred > 0,
        bucket: outstanding === 0 ? null : bucketFor(daysPastDue),
      };
    });
}

/** R5 + R13: every receipt dated on or before asOf, with what has been allocated from it by then. */
export function receiptPositions(data: ArData, asOf: string): ReceiptPosition[] {
  const allocated = new Map<number, Paise>();
  for (const a of data.allocations) {
    if (a.allocationDate <= asOf) allocated.set(a.receiptId, (allocated.get(a.receiptId) ?? 0) + a.amount);
  }
  return data.receipts
    .filter((r) => r.receiptDate <= asOf)
    .map((r) => {
      const settlement = r.bankAmount + r.tdsAmount;
      const alloc = allocated.get(r.id) ?? 0;
      return { receipt: r, settlement, allocated: alloc, unapplied: settlement - alloc };
    });
}

/** R13: one entry per customer, built from the invoice and receipt positions. */
export function customerPositions(data: ArData, asOf: string): CustomerPosition[] {
  const byCustomer = new Map<number, { buckets: Record<Bucket, Paise>; outstanding: Paise; unapplied: Paise }>();
  for (const c of data.customers) byCustomer.set(c.id, { buckets: emptyBuckets(), outstanding: 0, unapplied: 0 });

  for (const p of invoicePositions(data, asOf)) {
    const e = byCustomer.get(p.invoice.customerId);
    if (!e || p.bucket === null) continue;
    e.buckets[p.bucket] += p.outstanding;
    e.outstanding += p.outstanding;
  }
  for (const r of receiptPositions(data, asOf)) {
    const e = byCustomer.get(r.receipt.customerId);
    if (e) e.unapplied += r.unapplied;
  }

  return data.customers.map((customer) => {
    const { buckets, outstanding, unapplied } = byCustomer.get(customer.id)!;
    const netBalance = outstanding - unapplied;
    return {
      customer,
      buckets,
      outstanding,
      unapplied,
      netBalance,
      overdue: outstanding - buckets['Not due'],
      overLimit: netBalance > customer.creditLimit,
    };
  });
}

/** R14: a customer's balance from its documents alone: invoices − credit notes − receipts, dated ≤ asOf. */
export function balanceByDocuments(data: ArData, customerId: number, asOf: string): Paise {
  const invoices = data.invoices.filter((i) => i.customerId === customerId && !i.isCancelled);
  const invoiceIds = new Set(invoices.map((i) => i.id));
  let balance = 0;
  for (const i of invoices) if (i.invoiceDate <= asOf) balance += i.total;
  for (const c of data.creditNotes) if (invoiceIds.has(c.invoiceId) && c.creditNoteDate <= asOf) balance -= c.total;
  for (const r of data.receipts) {
    if (r.customerId === customerId && r.receiptDate <= asOf) balance -= r.bankAmount + r.tdsAmount;
  }
  return balance;
}

/** R14: the customers whose net balance disagrees with their documents. Must always be empty. */
export function balanceCheck(data: ArData, asOf: string): BalanceDifference[] {
  return customerPositions(data, asOf)
    .map((p) => ({
      customerId: p.customer.id,
      customerCode: p.customer.code,
      netBalance: p.netBalance,
      byDocuments: balanceByDocuments(data, p.customer.id, asOf),
    }))
    .filter((d) => d.netBalance !== d.byDocuments);
}
