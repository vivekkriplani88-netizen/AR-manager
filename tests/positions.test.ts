import { describe, expect, it } from 'vitest';
import {
  balanceByDocuments, balanceCheck, bucketFor, customerPositions, invoicePositions, receiptPositions,
} from '../lib/ar';
import { customer, eachDay, invoice, loadSample, sample as data } from './fixture';

const position = (no: string, asOf: string, d = data) =>
  invoicePositions(d, asOf).find((p) => p.invoice.invoiceNo === no);
const customerPosition = (code: string, asOf: string) =>
  customerPositions(data, asOf).find((p) => p.customer.code === code)!;

describe('bucketFor (R12)', () => {
  it('puts each boundary in the right bucket', () => {
    expect(bucketFor(-10)).toBe('Not due');
    expect(bucketFor(0)).toBe('Not due');
    expect(bucketFor(1)).toBe('1-30');
    expect(bucketFor(30)).toBe('1-30');
    expect(bucketFor(31)).toBe('31-60');
    expect(bucketFor(60)).toBe('31-60');
    expect(bucketFor(61)).toBe('61-90');
    expect(bucketFor(90)).toBe('61-90');
    expect(bucketFor(91)).toBe('91-180');
    expect(bucketFor(180)).toBe('91-180');
    expect(bucketFor(181)).toBe('Over 180');
  });
});

describe('invoicePositions (R10, R11)', () => {
  it('leaves out cancelled invoices and invoices dated after the as-at date', () => {
    expect(position('BWA/26-27/0014', '2026-10-31')).toBeUndefined();
    expect(position('BWA/26-27/0024', '2026-09-04')).toBeUndefined();
    expect(position('BWA/26-27/0024', '2026-09-05')).toBeDefined();
  });

  it('is still Due on its due date and Overdue the day after', () => {
    expect(position('BWA/26-27/0021', '2026-09-04')).toMatchObject({ status: 'Due', daysPastDue: 0, bucket: 'Not due' });
    expect(position('BWA/26-27/0021', '2026-09-05')).toMatchObject({ status: 'Overdue', daysPastDue: 1, bucket: '1-30' });
  });

  it('counts allocations by allocation date, not receipt date', () => {
    // RCT/26-27/0011 (₹1,00,000 advance) is dated 10-Jul but allocated to BWA/26-27/0017 only on 05-Sep.
    expect(position('BWA/26-27/0017', '2026-08-31')).toMatchObject({ received: 0, isPartPaid: false, outstanding: 11_800_000 });
    expect(position('BWA/26-27/0017', '2026-09-05')).toMatchObject({
      received: 10_000_000, outstanding: 1_800_000, status: 'Overdue', isPartPaid: true, daysPastDue: 22, bucket: '1-30',
    });
  });

  it('counts a credit note from its date', () => {
    expect(position('BWA/26-27/0007', '2026-07-24')!.credited).toBe(0);
    expect(position('BWA/26-27/0007', '2026-07-25')).toMatchObject({ credited: 2_950_000, isPartPaid: true });
  });

  it('labels a disputed invoice without changing its amount', () => {
    const p = position('BWA/26-27/0010', '2026-08-31')!;
    expect(p.invoice.isDisputed).toBe(true);
    expect(p.outstanding).toBe(4_720_000);
  });

  it('totals 21,18,100.00 outstanding as at 31-Aug-2026 (worked out by hand)', () => {
    const total = invoicePositions(data, '2026-08-31').reduce((s, p) => s + p.outstanding, 0);
    expect(total).toBe(211_810_000);
  });
});

describe('receiptPositions (R5)', () => {
  it('settles bank + TDS and leaves the rest unapplied', () => {
    const r = receiptPositions(data, '2026-08-31').find((x) => x.receipt.receiptNo === 'RCT/26-27/0007')!;
    expect(r).toMatchObject({ settlement: 7_200_000, allocated: 7_200_000, unapplied: 0 });
  });

  it('keeps an advance unapplied until its allocation date', () => {
    const at = (d: string) => receiptPositions(data, d).find((x) => x.receipt.receiptNo === 'RCT/26-27/0011')!;
    expect(at('2026-09-04').unapplied).toBe(10_000_000);
    expect(at('2026-09-05').unapplied).toBe(0);
  });

  it('leaves out receipts dated after the as-at date', () => {
    expect(receiptPositions(data, '2026-04-24')).toHaveLength(0);
    expect(receiptPositions(data, '2026-04-25')).toHaveLength(1);
  });
});

describe('customerPositions (R13)', () => {
  it('ages C003 as at 31-Aug-2026 and flags it over its limit (worked out by hand)', () => {
    expect(customerPosition('C003', '2026-08-31')).toMatchObject({
      buckets: { 'Not due': 0, '1-30': 0, '31-60': 8_260_000, '61-90': 0, '91-180': 18_700_000, 'Over 180': 17_700_000 },
      outstanding: 44_660_000,
      unapplied: 0,
      netBalance: 44_660_000,
      overdue: 44_660_000,
      overLimit: true,
    });
  });

  it('keeps unapplied credit out of the buckets (R13)', () => {
    const p = customerPosition('C005', '2026-08-31');
    expect(Object.values(p.buckets).reduce((s, x) => s + x, 0)).toBe(p.outstanding);
    expect(p.overdue).toBe(11_800_000); // BWA/26-27/0017, due 14-Aug; 0022 is not yet due
  });

  it('includes inactive customers', () => {
    expect(customerPosition('C008', '2026-08-31')).toMatchObject({ netBalance: 0 });
  });
});

describe('balanceCheck (R14)', () => {
  it('agrees with the documents for every customer on every day, 01-Jan to 31-Oct-2026', () => {
    for (const d of eachDay('2026-01-01', '2026-10-31')) expect(balanceCheck(data, d)).toEqual([]);
  });

  it('still agrees after part-payments, late allocations and a credit note are added', () => {
    const d = loadSample();
    const c = customer('C001', d);
    const inv = invoice('BWA/26-27/0024', d);
    d.receipts.push({
      id: -1, receiptNo: 'RCT/26-27/0018', customerId: c.id, receiptDate: '2026-09-20',
      bankAmount: 5_000_000, tdsAmount: 500_000, mode: 'NEFT', reference: null,
    });
    d.creditNotes.push({
      id: -1, creditNoteNo: 'BWA/CN/26-27/002', invoiceId: inv.id, creditNoteDate: '2026-09-22',
      taxableValue: 100_000, cgst: 9_000, sgst: 9_000, igst: 0, total: 118_000, reason: 'test',
    });
    d.allocations.push({ id: -1, receiptId: -1, invoiceId: inv.id, allocationDate: '2026-09-25', amount: 3_000_000 });

    for (const day of eachDay('2026-09-01', '2026-10-31')) expect(balanceCheck(d, day)).toEqual([]);
    expect(position('BWA/26-27/0024', '2026-09-25', d)).toMatchObject({
      received: 3_000_000, credited: 118_000, outstanding: 8_850_000 - 3_000_000 - 118_000, isPartPaid: true,
    });
    expect(customerPositions(d, '2026-09-25').find((p) => p.customer.id === c.id)!.unapplied).toBe(2_500_000);
  });

  it('balanceByDocuments ignores cancelled invoices', () => {
    // C007 on 01-Jul: only the cancelled BWA/26-27/0014; everything earlier is paid.
    expect(balanceByDocuments(data, customer('C007').id, '2026-07-01')).toBe(0);
  });
});
