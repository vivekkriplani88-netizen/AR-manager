import { describe, expect, it } from 'vitest';
import { addDays, creditNoteGst, daysBetween, documentTotal, dueDate, gstSplit } from '../lib/ar';
import { sample as data } from './fixture';

describe('daysBetween and addDays', () => {
  it('counts calendar days across month ends and leap years', () => {
    expect(daysBetween('2026-06-02', '2026-08-31')).toBe(90);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-08-31', '2026-08-30')).toBe(-1);
    expect(daysBetween('2026-09-04', '2026-09-04')).toBe(0);
  });

  it('adds and subtracts days', () => {
    expect(addDays('2026-01-31', 30)).toBe('2026-03-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('dueDate (R2)', () => {
  it('adds the credit days in calendar days', () => {
    expect(dueDate('2026-04-05', 30)).toBe('2026-05-05');
    expect(dueDate('2026-04-18', 45)).toBe('2026-06-02');
    expect(dueDate('2026-01-31', 30)).toBe('2026-03-02');
    expect(dueDate('2026-07-15', 0)).toBe('2026-07-15');
  });
});

describe('gstSplit (R3)', () => {
  it('splits CGST and SGST within Maharashtra and charges IGST elsewhere', () => {
    expect(gstSplit('Maharashtra', 7_500_000, 18)).toEqual({ cgst: 675_000, sgst: 675_000, igst: 0 });
    expect(gstSplit('Telangana', 35_000_000, 18)).toEqual({ cgst: 0, sgst: 0, igst: 6_300_000 });
  });

  it('rounds each component to the paisa, halves up', () => {
    expect(gstSplit('Maharashtra', 50, 18)).toEqual({ cgst: 5, sgst: 5, igst: 0 }); // 4.5 paise each
    expect(gstSplit('Maharashtra', 49, 18)).toEqual({ cgst: 4, sgst: 4, igst: 0 }); // 4.41
    expect(gstSplit('Gujarat', 25, 18)).toEqual({ cgst: 0, sgst: 0, igst: 5 }); // 4.5
    expect(gstSplit('Gujarat', 24, 18)).toEqual({ cgst: 0, sgst: 0, igst: 4 }); // 4.32
  });

  it('handles fractional rates and zero', () => {
    expect(gstSplit('Maharashtra', 100_000, 12.5)).toEqual({ cgst: 6_250, sgst: 6_250, igst: 0 });
    expect(gstSplit('Karnataka', 100_000, 0)).toEqual({ cgst: 0, sgst: 0, igst: 0 });
  });

  it('matches the state however it is capitalised or padded', () => {
    expect(gstSplit(' maharashtra ', 7_500_000, 18).cgst).toBe(675_000);
  });

  it('reproduces the stored GST, total and due date of every sample invoice', () => {
    for (const i of data.invoices) {
      const c = data.customers.find((x) => x.id === i.customerId)!;
      const gst = gstSplit(c.state, i.taxableValue, i.gstRatePct);
      expect({ no: i.invoiceNo, ...gst, total: documentTotal(i.taxableValue, gst), due: dueDate(i.invoiceDate, c.creditDays) })
        .toEqual({ no: i.invoiceNo, cgst: i.cgst, sgst: i.sgst, igst: i.igst, total: i.total, due: i.dueDate });
    }
  });
});

describe('creditNoteGst (R7)', () => {
  it('uses the invoice rate and split, reproducing the sample credit note', () => {
    const cn = data.creditNotes[0];
    const inv = data.invoices.find((i) => i.id === cn.invoiceId)!;
    const gst = creditNoteGst(inv, cn.taxableValue);
    expect(gst).toEqual({ cgst: 225_000, sgst: 225_000, igst: 0 });
    expect(documentTotal(cn.taxableValue, gst)).toBe(cn.total);
  });

  it('uses IGST for an IGST invoice', () => {
    const igstInvoice = data.invoices.find((i) => i.invoiceNo === 'BWA/26-27/0002')!;
    expect(creditNoteGst(igstInvoice, 1_000_000)).toEqual({ cgst: 0, sgst: 0, igst: 180_000 });
  });
});
