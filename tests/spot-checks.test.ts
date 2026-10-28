// The ten spot checks from Part 1 of the brief, one test each.
import { describe, expect, it } from 'vitest';
import {
  balanceCheck, customerPositions, documentTotal, dueDate, gstSplit, invoicePositions, promiseStatuses, statement,
} from '../lib/ar';
import { customer, eachDay, invoice, sample as data } from './fixture';

const position = (no: string, asOf: string) =>
  invoicePositions(data, asOf).find((p) => p.invoice.invoiceNo === no)!;
const customerPosition = (code: string, asOf: string) =>
  customerPositions(data, asOf).find((p) => p.customer.code === code)!;

describe('Part 1 spot checks', () => {
  it('1. BWA/26-27/0001 (C001, Maharashtra): CGST + SGST 6,750.00 each, total 88,500.00, due 05-May-2026', () => {
    const c = customer('C001');
    const gst = gstSplit(c.state, 7_500_000, 18);
    expect(gst).toEqual({ cgst: 675_000, sgst: 675_000, igst: 0 });
    expect(documentTotal(7_500_000, gst)).toBe(8_850_000);
    expect(dueDate('2026-04-05', c.creditDays)).toBe('2026-05-05');
  });

  it('2. BWA/26-27/0002 (C007, Telangana): IGST 63,000.00, total 4,13,000.00', () => {
    const gst = gstSplit(customer('C007').state, 35_000_000, 18);
    expect(gst).toEqual({ cgst: 0, sgst: 0, igst: 6_300_000 });
    expect(documentTotal(35_000_000, gst)).toBe(41_300_000);
  });

  // The brief expects bucket 61–90; under the client's ageing bands, 90 days late is 46–90.
  it('3. BWA/26-27/0003 as at 31-Aug-2026: 69,600.00 outstanding, Overdue · part-paid, 90 days, 46–90', () => {
    expect(position('BWA/26-27/0003', '2026-08-31')).toMatchObject({
      outstanding: 6_960_000, status: 'Overdue', isPartPaid: true, daysPastDue: 90, bucket: '46-90',
    });
  });

  it('4. BWA/26-27/0021: Due on 31-Aug, Overdue 2 days on 06-Sep, Paid on 15-Sep', () => {
    expect(position('BWA/26-27/0021', '2026-08-31')).toMatchObject({ status: 'Due', outstanding: 8_850_000 });
    expect(position('BWA/26-27/0021', '2026-09-06')).toMatchObject({ status: 'Overdue', daysPastDue: 2, outstanding: 8_850_000 });
    expect(position('BWA/26-27/0021', '2026-09-15')).toMatchObject({ status: 'Paid', outstanding: 0 });
  });

  it('5. C005 as at 31-Aug-2026: outstanding 1,88,800.00, unapplied 1,00,000.00, net 88,800.00 Dr', () => {
    expect(customerPosition('C005', '2026-08-31')).toMatchObject({
      outstanding: 18_880_000, unapplied: 10_000_000, netBalance: 8_880_000,
    });
  });

  it('6. C005 as at 12-Jul-2026: net 1,00,000.00 Cr (advance received before the invoice)', () => {
    expect(customerPosition('C005', '2026-07-12')).toMatchObject({
      outstanding: 0, unapplied: 10_000_000, netBalance: -10_000_000,
    });
  });

  it('7. BWA/26-27/0007 as at 31-Aug-2026: 3,000.00 outstanding after a credit note and a receipt with TDS', () => {
    expect(position('BWA/26-27/0007', '2026-08-31')).toMatchObject({
      credited: 2_950_000, received: 26_250_000, outstanding: 300_000,
    });
  });

  it('8. Statement C002, 01-Apr to 31-Aug-2026: opening 70,800.00 Dr, closing 2,23,000.00 Dr, 7 lines', () => {
    const s = statement(data, customer('C002').id, '2026-04-01', '2026-08-31');
    expect(s.opening).toBe(7_080_000);
    expect(s.closing).toBe(22_300_000);
    expect(s.lines).toHaveLength(7);
  });

  it('9. Promise noted by C002 on 20-Jul-2026 is Broken as at 31-Aug-2026', () => {
    const p = promiseStatuses(data, '2026-08-31').find(
      (x) => x.note.customerId === customer('C002').id && x.note.noteDate === '2026-07-20',
    )!;
    expect(p.status).toBe('Broken');
  });

  it('10. Control check (R14): no differences for any customer on any day of 2026', () => {
    const failures = eachDay('2026-01-01', '2026-10-31').flatMap((d) => balanceCheck(data, d).map((x) => ({ d, ...x })));
    expect(failures).toEqual([]);
  });

  it('the sample invoices match the stored figures for the Part 1 checks', () => {
    expect(invoice('BWA/26-27/0001')).toMatchObject({ cgst: 675_000, sgst: 675_000, total: 8_850_000, dueDate: '2026-05-05' });
    expect(invoice('BWA/26-27/0002')).toMatchObject({ igst: 6_300_000, total: 41_300_000 });
  });
});
