import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  allocationSummary, checkAllocations, expectedTds, openInvoices, suggestAllocations, unallocatedAmount,
} from '../lib/ar';
import { saveReceiptWithAllocations } from '../lib/receipt-save';
import { readAllocations, receiptSchema } from '../lib/validation/receipt';
import { customer, invoice, sample as data } from './fixture';

const today = '2026-10-28';
const nos = (open: { invoice: { invoiceNo: string } }[]) => open.map((o) => o.invoice.invoiceNo.slice(-4));

describe('openInvoices (R6)', () => {
  it('lists what is left to settle, oldest due date first', () => {
    const open = openInvoices(data, customer('C003').id, today);
    expect(nos(open)).toEqual(['0141', '0156', '0004', '0013']);
    expect(open.map((o) => o.remaining)).toEqual([17_700_000, 5_720_000, 12_980_000, 8_260_000]);
  });

  it('breaks a due-date tie by invoice number and leaves out paid and cancelled invoices', () => {
    // C007: 0014 cancelled, 0002/0008/0015 paid; only 0023 is open.
    expect(nos(openInvoices(data, customer('C007').id, today))).toEqual(['0023']);
    const c004 = openInvoices(data, customer('C004').id, today);
    expect(nos(c004)).toEqual(['0007', '0010', '0019']); // due 11-Jul, 31-Jul, 28-Sep
    expect(c004[0].remaining).toBe(300_000); // after the credit note and RCT/26-27/0013
  });

  it('only offers invoices dated on or before the allocation date', () => {
    expect(nos(openInvoices(data, customer('C001').id, '2026-09-04'))).toEqual([]);
    expect(nos(openInvoices(data, customer('C001').id, '2026-09-05'))).toEqual(['0024']);
  });
});

describe('suggestAllocations (R6)', () => {
  const open = openInvoices(data, customer('C003').id, today);

  it('fills the oldest invoices first and leaves the rest unapplied', () => {
    expect(suggestAllocations(open, 20_000_000).map((l) => l.amount)).toEqual([17_700_000, 2_300_000]);
    const all = suggestAllocations(open, 50_000_000);
    expect(allocationSummary(50_000_000, all)).toEqual({ allocated: 44_660_000, unapplied: 5_340_000, over: false });
  });

  it('suggests nothing for nothing', () => {
    expect(suggestAllocations(open, 0)).toEqual([]);
  });
});

describe('expectedTds (R5): the rate applied to the taxable value settled', () => {
  const c001 = openInvoices(data, customer('C001').id, today); // BWA/26-27/0024: ₹88,500, taxable ₹75,000

  it('matches what C001 deducts on its monthly retainer', () => {
    expect(expectedTds(c001, 8_100_000, 10)).toBe(750_000); // ₹81,000 in the bank + ₹7,500 TDS = ₹88,500
  });

  it('grosses up a part-payment', () => {
    expect(expectedTds(c001, 4_050_000, 10)).toBe(375_000); // settles ₹44,250, half the invoice
  });

  it('expects no TDS on the part that becomes an advance', () => {
    expect(expectedTds(c001, 10_000_000, 10)).toBe(750_000);
  });

  it('moves across invoices oldest first', () => {
    const c003 = openInvoices(data, customer('C003').id, today);
    expect(expectedTds(c003, 16_200_000, 10)).toBe(1_500_000); // exactly 0141: ₹1,77,000 less ₹15,000 TDS
    expect(expectedTds(c003, 15_930_000, 10)).toBe(1_475_000); // part of 0141: settles ₹1,74,050
  });

  it('is zero without a rate or a payment', () => {
    expect(expectedTds(c001, 8_100_000, 0)).toBe(0);
    expect(expectedTds(c001, 0, 10)).toBe(0);
    expect(expectedTds([], 8_100_000, 10)).toBe(0);
  });
});

describe('unallocatedAmount', () => {
  const receipt = (no: string) => data.receipts.find((r) => r.receiptNo === no)!;

  it('is bank + TDS less every allocation, whatever its date', () => {
    expect(unallocatedAmount(data, receipt('RCT/26-27/0011').id)).toBe(0); // allocated on 05-Sep
    expect(unallocatedAmount(data, receipt('RCT/26-27/0007').id)).toBe(0);
  });
});

describe('checkAllocations (R6)', () => {
  const c003 = customer('C003');
  const ctx = { customerId: c003.id, receiptDate: '2026-10-01', allocationDate: '2026-10-01', available: 20_000_000 };

  it('accepts allocations within every limit', () => {
    expect(checkAllocations(data, ctx, [{ invoiceId: invoice('BWA/25-26/0141').id, amount: 17_700_000 }])).toEqual([]);
  });

  it('refuses more than the receipt has', () => {
    const problems = checkAllocations(data, { ...ctx, available: 10_000_000 }, [{ invoiceId: invoice('BWA/25-26/0141').id, amount: 17_700_000 }]);
    expect(problems).toEqual(['The allocations add up to ₹1,77,000.00, but only ₹1,00,000.00 of the receipt is available.']);
  });

  it('refuses more than is left on the invoice', () => {
    expect(checkAllocations(data, ctx, [{ invoiceId: invoice('BWA/25-26/0156').id, amount: 5_720_001 }]))
      .toEqual(['Only ₹57,200.00 of BWA/25-26/0156 is left to settle.']);
  });

  it('refuses another customer’s invoice and a cancelled one', () => {
    expect(checkAllocations(data, ctx, [{ invoiceId: invoice('BWA/26-27/0024').id, amount: 100 }])).toContain('BWA/26-27/0024 belongs to another customer.');
    expect(checkAllocations(data, { ...ctx, customerId: customer('C007').id }, [{ invoiceId: invoice('BWA/26-27/0014').id, amount: 100 }]))
      .toContain('BWA/26-27/0014 is cancelled, so nothing can be allocated to it.');
  });

  it('refuses an allocation dated before the receipt or the invoice', () => {
    expect(checkAllocations(data, { ...ctx, allocationDate: '2026-09-30' }, [])).toEqual(['The allocation date cannot be before the receipt date (01-Oct-2026).']);
    const early = { customerId: customer('C001').id, receiptDate: '2026-09-01', allocationDate: '2026-09-01', available: 10_000_000 };
    expect(checkAllocations(data, early, [{ invoiceId: invoice('BWA/26-27/0024').id, amount: 100 }]))
      .toEqual(['BWA/26-27/0024 is dated 05-Sep-2026, after the allocation date.']);
  });
});

describe('receipt form input', () => {
  it('reads allocation amounts, skipping blanks and zeros', () => {
    const f = new FormData();
    f.append('alloc_10', '1,77,000');
    f.append('alloc_11', '');
    f.append('alloc_12', '0');
    f.append('alloc_13', 'lots');
    f.append('customerId', '5');
    expect(readAllocations(f)).toEqual({
      lines: [{ invoiceId: 10, amount: 17_700_000 }],
      values: { '10': '1,77,000', '11': '', '12': '0', '13': 'lots' },
      errors: { '13': 'Enter an amount in rupees, or leave it blank.' },
    });
  });

  it('requires a customer, date, mode and something received', () => {
    const ok = { customerId: '5', receiptDate: '2026-10-01', bankAmount: '81,000', tdsAmount: '7,500', mode: 'NEFT', reference: '' };
    expect(receiptSchema.parse(ok)).toMatchObject({ bankAmount: 8_100_000, tdsAmount: 750_000, reference: null });
    expect(receiptSchema.safeParse({ ...ok, bankAmount: '0', tdsAmount: '0' }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...ok, mode: 'Cash' }).success).toBe(false);
  });
});

/** A stand-in for the database that records what is asked of it, and can fail the allocations insert. */
function fakeDb({ failAllocations = false, failDelete = false } = {}) {
  const calls: string[] = [];
  const db = {
    from: (table: string) => ({
      insert: (rows: unknown) => {
        calls.push(`insert ${table} ${JSON.stringify(rows)}`);
        if (table === 'receipts') return { select: () => ({ single: async () => ({ data: { id: 99 }, error: null }) }) };
        return Promise.resolve({ error: failAllocations ? { code: 'P0001', message: 'Allocations exceed the invoice total.' } : null });
      },
      delete: () => ({
        eq: async (column: string, value: unknown) => {
          calls.push(`delete ${table} where ${column}=${value}`);
          return { error: failDelete ? { message: 'network down' } : null };
        },
      }),
    }),
  };
  return { db: db as unknown as SupabaseClient, calls };
}

describe('saveReceiptWithAllocations (section 4.8)', () => {
  const receipt = { receipt_no: 'RCT/26-27/0018', customer_id: 1, receipt_date: '2026-10-01', bank_amount: 81000, tds_amount: 7500, mode: 'NEFT', reference: null };
  const allocations = [{ invoice_id: 7, allocation_date: '2026-10-01', amount: 88500 }];

  it('saves the receipt, then all its allocations in one insert, tagged with its id', async () => {
    const { db, calls } = fakeDb();
    expect(await saveReceiptWithAllocations(db, receipt, allocations)).toEqual({ ok: true, receiptId: 99 });
    expect(calls).toEqual([
      `insert receipts ${JSON.stringify(receipt)}`,
      `insert allocations ${JSON.stringify([{ ...allocations[0], receipt_id: 99 }])}`,
    ]);
  });

  it('deletes the receipt again when the allocations cannot be saved', async () => {
    const { db, calls } = fakeDb({ failAllocations: true });
    const result = await saveReceiptWithAllocations(db, receipt, allocations);
    expect(result).toMatchObject({ ok: false, stage: 'allocations', rolledBack: true });
    expect(calls.at(-1)).toBe('delete receipts where id=99');
  });

  it('says so when even the clean-up fails', async () => {
    const { db } = fakeDb({ failAllocations: true, failDelete: true });
    expect(await saveReceiptWithAllocations(db, receipt, allocations)).toMatchObject({ ok: false, rolledBack: false });
  });

  it('saves a receipt with no allocations as unapplied credit', async () => {
    const { db, calls } = fakeDb();
    expect(await saveReceiptWithAllocations(db, receipt, [])).toEqual({ ok: true, receiptId: 99 });
    expect(calls).toHaveLength(1);
  });
});
