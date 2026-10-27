import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  canCancel, creditableAmount, invoiceRows, invoiceTotals, previewCreditNote, previewInvoice,
} from '../lib/ar';
import { invoiceList, parseInvoiceListQuery, type InvoiceListQuery } from '../lib/invoice-list';
import { creditNoteSchema, invoiceSchema } from '../lib/validation/invoice';
import { customer, invoice, loadSample, sample as data } from './fixture';

const rows = invoiceRows(data, '2026-08-31');
const list = (query: Partial<InvoiceListQuery>) =>
  invoiceList(rows, { q: '', customer: null, status: 'all', disputed: 'all', from: null, to: null, sort: 'invoiceDate', dir: 'asc', ...query });
const numbers = (query: Partial<InvoiceListQuery>) => list(query).map((r) => r.invoice.invoiceNo.slice(-4));

describe('invoiceRows (R8, R10, R11)', () => {
  it('lists every invoice dated on or before the as-at date, cancelled ones included', () => {
    expect(rows).toHaveLength(28); // 29 invoices less BWA/26-27/0024, dated 05-Sep
    const cancelled = rows.find((r) => r.invoice.invoiceNo === 'BWA/26-27/0014')!;
    expect(cancelled).toMatchObject({ status: 'Cancelled', received: 0, credited: 0, outstanding: 0, bucket: null });
  });

  it('totals outstanding without the cancelled invoice (worked out by hand in Step 4)', () => {
    const t = invoiceTotals(rows);
    expect(t).toMatchObject({ count: 27, cancelled: 1, outstanding: 211_810_000 });
    expect(t.total).toBe(t.received + t.credited + t.outstanding);
  });
});

describe('invoiceList filters', () => {
  it('filters by status, with Open meaning due or overdue', () => {
    expect(numbers({ status: 'cancelled' })).toEqual(['0014']);
    // Due 03-Sep (C002, 45 days), 28-Sep (C004, 60 days), 04-Sep, 19-Sep and 09-Oct.
    expect(numbers({ status: 'due' })).toEqual(['0018', '0019', '0021', '0022', '0023']);
    const open = list({ status: 'open' });
    expect(open.every((r) => r.status === 'Due' || r.status === 'Overdue')).toBe(true);
    expect(invoiceTotals(open).outstanding).toBe(211_810_000);
  });

  it('filters by customer, disputed flag and invoice date range', () => {
    expect(numbers({ customer: customer('C005').id })).toEqual(['0017', '0022']);
    expect(numbers({ disputed: 'yes' })).toEqual(['0010']);
    expect(numbers({ from: '2026-08-01', to: '2026-08-31' })).toEqual(['0020', '0021', '0022', '0023']);
  });

  it('searches by number', () => {
    expect(numbers({ q: '25-26/01' })).toEqual(['0141', '0156', '0162', '0170', '0171']);
  });

  it('sorts by days late with the longest first, blanks last', () => {
    const late = list({ sort: 'daysLate', dir: 'desc' });
    expect(late[0].invoice.invoiceNo).toBe('BWA/25-26/0141'); // due 19-Feb: 193 days
    expect(late.at(-1)!.status).not.toBe('Overdue');
  });

  it('totals only the filtered rows', () => {
    expect(invoiceTotals(list({ customer: customer('C005').id }))).toMatchObject({ count: 2, outstanding: 18_880_000 });
  });

  it('reads filters from the URL, ignoring anything invalid', () => {
    expect(parseInvoiceListQuery({ status: 'open', customer: '553', from: '2026-08-01', to: '2026-02-30', sort: 'daysLate', dir: 'desc' }))
      .toMatchObject({ status: 'open', customer: 553, from: '2026-08-01', to: null, sort: 'daysLate', dir: 'desc' });
    expect(parseInvoiceListQuery({ status: 'lost', customer: 'abc' })).toMatchObject({ status: 'all', customer: null, sort: 'invoiceDate' });
  });
});

describe('previewInvoice (R2, R3, R4, R9)', () => {
  it('previews the next invoice for C001 as at 01-Oct-2026', () => {
    expect(previewInvoice(data, customer('C001'), '2026-10-01', 7_500_000, 18)).toEqual({
      invoiceNo: 'BWA/26-27/0025',
      dueDate: '2026-10-31',
      gst: { cgst: 675_000, sgst: 675_000, igst: 0 },
      total: 8_850_000,
      balanceBefore: 8_850_000, // BWA/26-27/0024 is still open
      balanceAfter: 17_700_000,
      creditLimit: 50_000_000,
      overLimit: false,
    });
  });

  it('warns when the invoice would take the customer over its limit', () => {
    // C003 owes ₹4,46,600 against a ₹4,00,000 limit; C006 owes ₹35,400 against ₹1,00,000.
    expect(previewInvoice(data, customer('C003'), '2026-08-31', 100, 18).overLimit).toBe(true);
    expect(previewInvoice(data, customer('C006'), '2026-08-31', 5_000_000, 18).overLimit).toBe(false); // 35,400 + 59,000
    expect(previewInvoice(data, customer('C006'), '2026-08-31', 6_000_000, 18).overLimit).toBe(true); // 35,400 + 70,800
  });

  it('counts an advance against the limit', () => {
    // C005 on 12-Jul: ₹1,00,000 Cr. An invoice of ₹2,95,000 leaves ₹1,95,000 Dr, under the ₹2,50,000 limit.
    expect(previewInvoice(data, customer('C005'), '2026-07-12', 25_000_000, 18)).toMatchObject({
      balanceBefore: -10_000_000, balanceAfter: 19_500_000, overLimit: false,
    });
  });
});

describe('creditableAmount and canCancel (R6, R7, R8)', () => {
  it('counts every allocation and credit note, whatever its date', () => {
    expect(creditableAmount(data, invoice('BWA/26-27/0007').id)).toBe(300_000);
    expect(creditableAmount(data, invoice('BWA/26-27/0017').id)).toBe(1_800_000); // allocated on 05-Sep
    expect(creditableAmount(data, invoice('BWA/26-27/0024').id)).toBe(8_850_000);
    expect(creditableAmount(data, invoice('BWA/26-27/0014').id)).toBe(0); // cancelled
  });

  it('allows cancelling only an untouched, live invoice', () => {
    expect(canCancel(data, invoice('BWA/26-27/0024'))).toBe(true);
    expect(canCancel(data, invoice('BWA/26-27/0017'))).toBe(false); // part-paid
    expect(canCancel(data, invoice('BWA/26-27/0007'))).toBe(false); // credited and paid
    expect(canCancel(data, invoice('BWA/26-27/0014'))).toBe(false); // already cancelled
  });
});

describe('previewCreditNote (R4, R7)', () => {
  it('uses the invoice rate and split and the next number', () => {
    const p = previewCreditNote(data, invoice('BWA/26-27/0007'), '2026-09-01', 254_237);
    expect(p).toMatchObject({ creditNoteNo: 'BWA/CN/26-27/002', gst: { cgst: 22_881, sgst: 22_881, igst: 0 }, total: 299_999 });
    expect(p.exceedsCreditable).toBe(false);
  });

  it('refuses more than is left on the invoice', () => {
    expect(previewCreditNote(data, invoice('BWA/26-27/0007'), '2026-09-01', 254_300).exceedsCreditable).toBe(true); // 3,000.74
  });

  it('charges IGST on an IGST invoice', () => {
    expect(previewCreditNote(data, invoice('BWA/26-27/0023'), '2026-09-01', 1_000_000).gst).toEqual({ cgst: 0, sgst: 0, igst: 180_000 });
  });

  it('agrees with a credit note added to the data', () => {
    const d = loadSample();
    const inv = invoice('BWA/26-27/0024', d);
    const p = previewCreditNote(d, inv, '2026-09-10', 1_000_000);
    d.creditNotes.push({ id: -1, creditNoteNo: p.creditNoteNo, invoiceId: inv.id, creditNoteDate: '2026-09-10', taxableValue: 1_000_000, ...p.gst, total: p.total, reason: 'test' });
    expect(creditableAmount(d, inv.id)).toBe(8_850_000 - 1_180_000);
  });
});

describe('invoice and credit note validation', () => {
  const errors = (schema: z.ZodType, input: object) => {
    const r = schema.safeParse(input);
    return r.success ? {} : z.flattenError(r.error).fieldErrors;
  };

  it('requires a customer, real date, description, positive taxable value and a rate from 0 to 100', () => {
    expect(errors(invoiceSchema, { customerId: '553', invoiceDate: '2026-10-01', description: 'Retainer', taxableValue: '75,000', gstRatePct: '18' })).toEqual({});
    expect(Object.keys(errors(invoiceSchema, { customerId: '', invoiceDate: '2026-02-30', description: ' ', taxableValue: '0', gstRatePct: '118' })).sort())
      .toEqual(['customerId', 'description', 'gstRatePct', 'invoiceDate', 'taxableValue']);
  });

  it('requires a credit note date, positive taxable value and reason', () => {
    expect(Object.keys(errors(creditNoteSchema, { creditNoteDate: '', taxableValue: '-5', reason: '' })).sort())
      .toEqual(['creditNoteDate', 'reason', 'taxableValue']);
  });
});
