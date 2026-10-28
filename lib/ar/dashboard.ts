// "Overdue at a glance" (Part 2): every figure on the home screen, from the same positions as
// the rest of the app, so the dashboard cannot disagree with the customer and invoice pages.
import { dso } from './dso';
import { followUpsDue, promiseStatuses, type PromiseToPay } from './notes';
import {
  customerPositions, emptyBuckets, invoicePositions, receiptPositions, BUCKETS,
  type Bucket, type CustomerPosition, type InvoicePosition, type ReceiptPosition,
} from './positions';
import type { ArData, Note, Paise } from './types';

export interface DashboardSummary {
  outstanding: Paise; // Σ invoice outstanding, before unapplied credit
  unapplied: Paise;
  netReceivable: Paise; // outstanding − unapplied
  overdue: Paise;
  overduePct: number | null; // overdue as a percentage of outstanding; null when nothing is outstanding
  dso: number | null;
  overdueCount: number;
}

export interface AgeingTotals { buckets: Record<Bucket, Paise>; outstanding: Paise; unapplied: Paise; netBalance: Paise; overdue: Paise }

export interface Dashboard {
  summary: DashboardSummary;
  ageing: CustomerPosition[]; // customers with anything outstanding or unapplied
  ageingTotals: AgeingTotals;
  overdueInvoices: InvoicePosition[]; // longest overdue first
  overLimit: CustomerPosition[];
  brokenPromises: PromiseToPay[];
  followUps: Note[];
  unappliedReceipts: ReceiptPosition[];
}

export function dashboard(data: ArData, asOf: string): Dashboard {
  const customers = customerPositions(data, asOf);
  const ageing = customers.filter((p) => p.outstanding !== 0 || p.unapplied !== 0);

  const totals: AgeingTotals = { buckets: emptyBuckets(), outstanding: 0, unapplied: 0, netBalance: 0, overdue: 0 };
  for (const p of ageing) {
    for (const b of BUCKETS) totals.buckets[b] += p.buckets[b];
    totals.outstanding += p.outstanding;
    totals.unapplied += p.unapplied;
    totals.netBalance += p.netBalance;
    totals.overdue += p.overdue;
  }

  const overdueInvoices = invoicePositions(data, asOf)
    .filter((p) => p.status === 'Overdue')
    .sort((a, b) => b.daysPastDue - a.daysPastDue || a.invoice.invoiceNo.localeCompare(b.invoice.invoiceNo));

  return {
    summary: {
      outstanding: totals.outstanding,
      unapplied: totals.unapplied,
      netReceivable: totals.netBalance,
      overdue: totals.overdue,
      overduePct: totals.outstanding > 0 ? (totals.overdue / totals.outstanding) * 100 : null,
      dso: dso(data, asOf),
      overdueCount: overdueInvoices.length,
    },
    ageing,
    ageingTotals: totals,
    overdueInvoices,
    overLimit: customers.filter((p) => p.overLimit),
    brokenPromises: promiseStatuses(data, asOf).filter((p) => p.status === 'Broken'),
    followUps: followUpsDue(data, asOf).sort((a, b) => a.followUpDate!.localeCompare(b.followUpDate!)),
    unappliedReceipts: receiptPositions(data, asOf).filter((r) => r.unapplied > 0),
  };
}
