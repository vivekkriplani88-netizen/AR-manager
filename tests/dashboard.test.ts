import { describe, expect, it } from 'vitest';
import { BUCKETS, customerPositions, dashboard, dso, invoicePositions } from '../lib/ar';
import { eachDay, sample as data } from './fixture';

describe('dashboard as at 31-Aug-2026 (figures worked out by hand)', () => {
  const d = dashboard(data, '2026-08-31');

  it('summarises the receivable', () => {
    expect(d.summary).toMatchObject({
      outstanding: 211_810_000,
      unapplied: 10_000_000, // C005's advance, RCT/26-27/0011
      netReceivable: 201_810_000,
      overdue: 128_620_000, // outstanding less ₹8,31,900 not yet due
      dso: 111,
      overdueCount: 11,
    });
    expect(d.summary.overduePct).toBeCloseTo(60.725, 2);
  });

  it('lists overdue invoices longest first', () => {
    // Ties (0015 and 0020, both due 16-Aug) go by invoice number.
    expect(d.overdueInvoices.map((p) => p.invoice.invoiceNo.slice(-4))).toEqual([
      '0141', '0156', '0004', '0003', '0009', '0007', '0013', '0010', '0017', '0015', '0020',
    ]);
    expect(d.overdueInvoices.map((p) => p.daysPastDue)).toEqual([193, 157, 98, 90, 56, 51, 34, 31, 17, 15, 15]);
  });

  it('flags what needs attention', () => {
    expect(d.overLimit.map((p) => p.customer.code)).toEqual(['C003']);
    expect(d.brokenPromises.map((p) => p.note.noteDate)).toEqual(['2026-07-20']);
    expect(d.followUps).toEqual([]);
    expect(d.unappliedReceipts.map((r) => [r.receipt.receiptNo, r.unapplied])).toEqual([['RCT/26-27/0011', 10_000_000]]);
  });

  it('ages by customer without netting unapplied credit against any bucket', () => {
    expect(d.ageing.map((p) => p.customer.code)).toEqual(['C001', 'C002', 'C003', 'C004', 'C005', 'C006', 'C007']); // C008 owes nothing
    const c005 = d.ageing.find((p) => p.customer.code === 'C005')!;
    expect(c005.buckets).toMatchObject({ 'Not due': 7_080_000, '16-30': 11_800_000 }); // 0017 is 17 days late
    expect(c005.unapplied).toBe(10_000_000);
  });

  it('totals each ageing band (worked out by hand)', () => {
    expect(d.ageingTotals.buckets).toEqual({
      'Not due': 83_190_000, // 0018, 0019, 0021, 0022, 0023
      '1-15': 50_740_000, // 0015 and 0020, 15 days
      '16-30': 11_800_000, // 0017, 17 days
      '31-45': 12_980_000, // 0013 (34) and 0010 (31)
      '46-90': 16_700_000, // 0003 (90), 0009 (56) and 0007 (51)
      'Over 90': 36_400_000, // 0141 (193), 0156 (157) and 0004 (98)
    });
  });
});

describe('dashboard on other dates', () => {
  it('lists follow-ups due once their date arrives, earliest first', () => {
    expect(dashboard(data, '2026-09-10').followUps.map((n) => n.followUpDate)).toEqual(['2026-09-01', '2026-09-05', '2026-09-10']);
  });

  it('shows C005 as a credit balance on 12-Jul, with nothing overdue for it', () => {
    const c005 = dashboard(data, '2026-07-12').ageing.find((p) => p.customer.code === 'C005')!;
    expect(c005).toMatchObject({ outstanding: 0, unapplied: 10_000_000, netBalance: -10_000_000 });
  });

  it('agrees with itself and the rest of the app on every day of 2026', () => {
    for (const day of eachDay('2026-01-01', '2026-10-31')) {
      const d = dashboard(data, day);
      const t = d.ageingTotals;
      const positions = invoicePositions(data, day);
      expect(BUCKETS.reduce((sum, b) => sum + t.buckets[b], 0)).toBe(t.outstanding);
      expect(t.outstanding).toBe(positions.reduce((sum, p) => sum + p.outstanding, 0));
      expect(t.netBalance).toBe(customerPositions(data, day).reduce((sum, p) => sum + p.netBalance, 0));
      expect(d.summary.netReceivable).toBe(t.outstanding - t.unapplied);
      expect(d.summary.overdue).toBe(t.outstanding - t.buckets['Not due']);
      expect(d.summary.overdueCount).toBe(positions.filter((p) => p.status === 'Overdue').length);
      expect(d.summary.dso).toBe(dso(data, day));
    }
  });
});
