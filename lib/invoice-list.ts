// Search, filters and sort for the invoice list (Part 2). Works on rows from lib/ar.
import { BUCKETS, type Bucket, type InvoiceRow, type InvoiceStatusName } from './ar';
import { isValidDate } from './asof';
import type { SortDir } from './customer-list';

export const INVOICE_SORTS = [
  'number', 'customer', 'invoiceDate', 'dueDate', 'total', 'received', 'credited', 'outstanding', 'status', 'daysLate',
] as const;
export type InvoiceSort = (typeof INVOICE_SORTS)[number];

/** 'open' is Due and Overdue together: everything still to collect. */
export const STATUS_FILTERS = ['all', 'open', 'overdue', 'due', 'paid', 'cancelled'] as const;
export type InvoiceStatusFilter = (typeof STATUS_FILTERS)[number];

export interface InvoiceListQuery {
  q: string;
  customer: number | null;
  status: InvoiceStatusFilter;
  disputed: 'all' | 'yes' | 'no';
  bucket: Bucket | null; // ageing bucket (R12), for click-through from the ageing table
  from: string | null;
  to: string | null;
  sort: InvoiceSort;
  dir: SortDir;
}

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const oneOf = <T extends string>(list: readonly T[], value: string, fallback: T): T =>
  (list as readonly string[]).includes(value) ? (value as T) : fallback;

export function parseInvoiceListQuery(params: Params): InvoiceListQuery {
  const customer = first(params.customer);
  const from = first(params.from);
  const to = first(params.to);
  const disputed = first(params.disputed);
  const bucket = first(params.bucket);
  return {
    q: first(params.q).trim(),
    customer: /^\d+$/.test(customer) ? Number(customer) : null,
    status: oneOf(STATUS_FILTERS, first(params.status), 'all'),
    disputed: disputed === 'yes' || disputed === 'no' ? disputed : 'all',
    bucket: (BUCKETS as string[]).includes(bucket) ? (bucket as Bucket) : null,
    from: isValidDate(from) ? from : null,
    to: isValidDate(to) ? to : null,
    sort: oneOf(INVOICE_SORTS, first(params.sort), 'invoiceDate'),
    dir: first(params.dir) === 'desc' ? 'desc' : 'asc',
  };
}

const STATUS_RANK: Record<InvoiceStatusName, number> = { Overdue: 0, Due: 1, Paid: 2, Cancelled: 3 };

const sortValue: Record<InvoiceSort, (r: InvoiceRow) => string | number | null> = {
  number: (r) => r.invoice.invoiceNo,
  customer: (r) => r.customer.name,
  invoiceDate: (r) => r.invoice.invoiceDate,
  dueDate: (r) => r.invoice.dueDate,
  total: (r) => r.invoice.total,
  received: (r) => (r.status === 'Cancelled' ? null : r.received),
  credited: (r) => (r.status === 'Cancelled' ? null : r.credited),
  outstanding: (r) => (r.status === 'Cancelled' ? null : r.outstanding),
  status: (r) => STATUS_RANK[r.status],
  daysLate: (r) => (r.status === 'Overdue' ? r.daysPastDue : null),
};

function compare(a: string | number, b: string | number): number {
  return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'en-IN');
}

function matchesStatus(r: InvoiceRow, status: InvoiceStatusFilter): boolean {
  switch (status) {
    case 'all': return true;
    case 'open': return r.status === 'Due' || r.status === 'Overdue';
    default: return r.status.toLowerCase() === status;
  }
}

/** Filter by number, customer, status, disputed flag, ageing bucket and invoice date range; then sort, ties by number. */
export function invoiceList(rows: InvoiceRow[], query: InvoiceListQuery): InvoiceRow[] {
  const q = query.q.toLowerCase();
  const get = sortValue[query.sort];
  const sign = query.dir === 'desc' ? -1 : 1;
  return rows
    .filter((r) => !q || r.invoice.invoiceNo.toLowerCase().includes(q))
    .filter((r) => query.customer === null || r.customer.id === query.customer)
    .filter((r) => matchesStatus(r, query.status))
    .filter((r) => query.disputed === 'all' || r.invoice.isDisputed === (query.disputed === 'yes'))
    .filter((r) => query.bucket === null || r.bucket === query.bucket)
    .filter((r) => (!query.from || r.invoice.invoiceDate >= query.from) && (!query.to || r.invoice.invoiceDate <= query.to))
    .sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const primary =
        va === null || vb === null ? (va === vb ? 0 : va === null ? 1 : -1) // blanks last either way
        : sign * compare(va, vb);
      return primary || compare(a.invoice.invoiceNo, b.invoice.invoiceNo);
    });
}
