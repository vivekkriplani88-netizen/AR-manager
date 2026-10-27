import { describe, expect, it } from 'vitest';
import { addDays, balanceByDocuments, statement } from '../lib/ar';
import { customer, invoice, loadSample, sample as data } from './fixture';

describe('statement (R15)', () => {
  it('lists C002 from 01-Apr to 31-Aug-2026 line by line', () => {
    const s = statement(data, customer('C002').id, '2026-04-01', '2026-08-31');
    expect(s.opening).toBe(7_080_000);
    expect(s.lines.map((l) => [l.date, l.type, l.documentNo, l.debit, l.credit, l.balance])).toEqual([
      ['2026-04-18', 'Invoice', 'BWA/26-27/0003', 14_160_000, 0, 21_240_000],
      ['2026-05-20', 'Payment', 'RCT/26-27/0005', 0, 6_480_000, 14_760_000],
      ['2026-05-20', 'TDS', 'RCT/26-27/0005', 0, 600_000, 14_160_000],
      ['2026-05-22', 'Invoice', 'BWA/26-27/0009', 9_440_000, 0, 23_600_000],
      ['2026-06-15', 'Payment', 'RCT/26-27/0007', 0, 6_000_000, 17_600_000],
      ['2026-06-15', 'TDS', 'RCT/26-27/0007', 0, 1_200_000, 16_400_000],
      ['2026-07-20', 'Invoice', 'BWA/26-27/0018', 5_900_000, 0, 22_300_000],
    ]);
    expect(s.lines[1].description).toBe('Payment received');
    expect(s.lines[2].description).toBe('TDS deducted by you');
    expect(s.closing).toBe(22_300_000);
  });

  it('leaves out a TDS line when the receipt has no TDS', () => {
    const s = statement(data, customer('C006').id, '2026-05-01', '2026-05-31');
    expect(s.lines.map((l) => l.type)).toEqual(['Payment']);
  });

  it('leaves out cancelled invoices', () => {
    const s = statement(data, customer('C007').id, '2026-07-01', '2026-07-31');
    expect(s.lines.map((l) => l.documentNo)).toEqual(['BWA/26-27/0015']);
  });

  it('shows a credit note as a credit of its total', () => {
    const s = statement(data, customer('C004').id, '2026-07-25', '2026-07-25');
    expect(s.lines).toMatchObject([{ type: 'Credit note', documentNo: 'BWA/CN/26-27/001', debit: 0, credit: 2_950_000 }]);
  });

  it('orders a single day: invoices, credit notes, receipts, TDS, then by number', () => {
    const d = loadSample();
    const c = customer('C002', d);
    const base = invoice('BWA/26-27/0018', d);
    const day = '2026-10-01';
    d.receipts.push({
      id: -1, receiptNo: 'RCT/26-27/0018', customerId: c.id, receiptDate: day,
      bankAmount: 90_000, tdsAmount: 10_000, mode: 'UPI', reference: null,
    });
    d.invoices.push({ ...base, id: -2, invoiceNo: 'BWA/26-27/0026', invoiceDate: day, dueDate: addDays(day, 45) });
    d.creditNotes.push({
      id: -1, creditNoteNo: 'BWA/CN/26-27/002', invoiceId: -2, creditNoteDate: day,
      taxableValue: 100_000, cgst: 9_000, sgst: 9_000, igst: 0, total: 118_000, reason: 'test',
    });
    d.invoices.push({ ...base, id: -3, invoiceNo: 'BWA/26-27/0025', invoiceDate: day, dueDate: addDays(day, 45) });

    const s = statement(d, c.id, day, day);
    expect(s.lines.map((l) => `${l.type} ${l.documentNo}`)).toEqual([
      'Invoice BWA/26-27/0025',
      'Invoice BWA/26-27/0026',
      'Credit note BWA/CN/26-27/002',
      'Payment RCT/26-27/0018',
      'TDS RCT/26-27/0018',
    ]);
  });

  it('closes on the R14 balance for every customer and every period', () => {
    const monthEnds = ['01-31', '02-28', '03-31', '04-30', '05-31', '06-30', '07-31', '08-31', '09-30', '10-31'];
    const periods: [string, string][] = [
      ['2026-01-01', '2026-10-31'],
      ['2026-04-01', '2026-08-31'],
      ['2026-09-06', '2026-09-06'],
      ...monthEnds.map((end): [string, string] => [`2026-${end.slice(0, 2)}-01`, `2026-${end}`]),
    ];
    for (const c of data.customers) {
      for (const [from, to] of periods) {
        const s = statement(data, c.id, from, to);
        expect(s.opening).toBe(balanceByDocuments(data, c.id, addDays(from, -1)));
        expect(s.closing).toBe(balanceByDocuments(data, c.id, to));
        // The ageing footer accounts for the whole closing balance.
        const aged = Object.values(s.buckets).reduce((sum, x) => sum + x, 0);
        expect(aged - s.unapplied).toBe(s.closing);
      }
    }
  });

  it('refuses a period that ends before it starts', () => {
    expect(() => statement(data, customer('C001').id, '2026-08-31', '2026-08-01')).toThrow();
  });
});
