import { describe, expect, it } from 'vitest';
import { customerPositions } from '../lib/ar';
import { customerList, parseCustomerListQuery, type CustomerListQuery } from '../lib/customer-list';
import { sample } from './fixture';

const rows = customerPositions(sample, '2026-08-31');
const codes = (query: Partial<CustomerListQuery>) =>
  customerList(rows, { q: '', status: 'all', sort: 'code', dir: 'asc', ...query }).map((p) => p.customer.code);

describe('customerList', () => {
  it('lists every customer by code by default', () => {
    expect(codes({})).toEqual(['C001', 'C002', 'C003', 'C004', 'C005', 'C006', 'C007', 'C008']);
  });

  it('searches code, name, contact and email, ignoring case', () => {
    expect(codes({ q: 'c003' })).toEqual(['C003']);
    expect(codes({ q: 'FREIGHT' })).toEqual(['C002']);
    expect(codes({ q: 'neha' })).toEqual(['C001']);
    expect(codes({ q: 'mulshiagro@' })).toEqual(['C006']);
    expect(codes({ q: 'nobody' })).toEqual([]);
  });

  it('filters active and inactive', () => {
    expect(codes({ status: 'inactive' })).toEqual(['C008']);
    expect(codes({ status: 'active' })).not.toContain('C008');
  });

  it('sorts by balance, largest first', () => {
    // As at 31-Aug: C007 ₹7,31,600, C003 ₹4,46,600, C004 ₹4,04,200 …
    expect(codes({ sort: 'balance', dir: 'desc' }).slice(0, 3)).toEqual(['C007', 'C003', 'C004']);
  });

  it('sorts by limit used and by text columns', () => {
    expect(codes({ sort: 'limitUsed', dir: 'desc' })[0]).toBe('C003'); // 111.7% of ₹4,00,000
    expect(codes({ sort: 'name' })[0]).toBe('C008'); // Kamshet …
    expect(codes({ sort: 'status', dir: 'desc' })[0]).toBe('C008'); // Inactive after Active
  });

  it('breaks ties by code', () => {
    expect(codes({ sort: 'creditDays' }).slice(0, 2)).toEqual(['C006', 'C001']); // 15 days, then 30 days (C001 first)
  });
});

describe('parseCustomerListQuery', () => {
  it('reads the URL and falls back to defaults for anything unknown', () => {
    expect(parseCustomerListQuery({ q: ' tamhini ', status: 'inactive', sort: 'overdue', dir: 'desc' }))
      .toEqual({ q: 'tamhini', status: 'inactive', sort: 'overdue', dir: 'desc' });
    expect(parseCustomerListQuery({ status: 'deleted', sort: 'password', dir: 'sideways' }))
      .toEqual({ q: '', status: 'all', sort: 'code', dir: 'asc' });
  });
});
