// Search, filter and sort for the customer list (Part 2). Works on positions from lib/ar.
import type { CustomerPosition } from './ar';

export const CUSTOMER_SORTS = [
  'code', 'name', 'location', 'contact', 'creditDays', 'creditLimit', 'balance', 'overdue', 'limitUsed', 'status',
] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];
export type StatusFilter = 'all' | 'active' | 'inactive';
export type SortDir = 'asc' | 'desc';

export interface CustomerListQuery { q: string; status: StatusFilter; sort: CustomerSort; dir: SortDir }

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function parseCustomerListQuery(params: Params): CustomerListQuery {
  const status = first(params.status);
  const sort = first(params.sort);
  return {
    q: first(params.q).trim(),
    status: status === 'active' || status === 'inactive' ? status : 'all',
    sort: (CUSTOMER_SORTS as readonly string[]).includes(sort) ? (sort as CustomerSort) : 'code',
    dir: first(params.dir) === 'desc' ? 'desc' : 'asc',
  };
}

const sortValue: Record<CustomerSort, (p: CustomerPosition) => string | number | null> = {
  code: (p) => p.customer.code,
  name: (p) => p.customer.name,
  location: (p) => `${p.customer.state} ${p.customer.city}`,
  contact: (p) => p.customer.contactPerson,
  creditDays: (p) => p.customer.creditDays,
  creditLimit: (p) => p.customer.creditLimit,
  balance: (p) => p.netBalance,
  overdue: (p) => p.overdue,
  limitUsed: (p) => p.limitUsedPct,
  status: (p) => (p.customer.isActive ? 'Active' : 'Inactive'),
};

function compare(a: string | number | null, b: string | number | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1; // blanks last either way
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en-IN', { sensitivity: 'base' });
}

/** Search by code, name, contact or email; filter by status; sort by any column, then by code. */
export function customerList(rows: CustomerPosition[], query: CustomerListQuery): CustomerPosition[] {
  const q = query.q.toLowerCase();
  const get = sortValue[query.sort];
  const sign = query.dir === 'desc' ? -1 : 1;
  return rows
    .filter((p) => query.status === 'all' || p.customer.isActive === (query.status === 'active'))
    .filter((p) => {
      if (!q) return true;
      const c = p.customer;
      return [c.code, c.name, c.contactPerson, c.email].some((field) => field.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const primary = va === null || vb === null ? compare(va, vb) : sign * compare(va, vb);
      return primary || compare(a.customer.code, b.customer.code);
    });
}
