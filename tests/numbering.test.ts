import { describe, expect, it } from 'vitest';
import { fyLabel, nextNumber } from '../lib/ar';
import { loadSample, sample as data } from './fixture';

describe('fyLabel (R4)', () => {
  it('runs from April to March', () => {
    expect(fyLabel('2026-03-31')).toBe('25-26');
    expect(fyLabel('2026-04-01')).toBe('26-27');
    expect(fyLabel('2027-01-15')).toBe('26-27');
    expect(fyLabel('2099-12-01')).toBe('99-00');
  });
});

describe('nextNumber (R4)', () => {
  it('gives the next numbers after the sample data, as in the brief', () => {
    expect(nextNumber('invoice', data, '2026-10-01')).toBe('BWA/26-27/0025');
    expect(nextNumber('creditNote', data, '2026-10-01')).toBe('BWA/CN/26-27/002');
    expect(nextNumber('receipt', data, '2026-10-01')).toBe('RCT/26-27/0018');
  });

  it('restarts each 1 April', () => {
    expect(nextNumber('invoice', data, '2027-04-01')).toBe('BWA/27-28/0001');
    expect(nextNumber('creditNote', data, '2027-04-01')).toBe('BWA/CN/27-28/001');
    expect(nextNumber('receipt', data, '2027-04-01')).toBe('RCT/27-28/0001');
  });

  it('numbers by the document date, not today', () => {
    expect(nextNumber('invoice', data, '2026-03-31')).toBe('BWA/25-26/0172');
  });

  it('never reuses the number of a cancelled invoice', () => {
    const d = loadSample();
    const template = d.invoices.find((i) => i.invoiceNo === 'BWA/26-27/0024')!;
    d.invoices.push({ ...template, id: -1, invoiceNo: 'BWA/26-27/0030', isCancelled: true });
    expect(nextNumber('invoice', d, '2026-10-01')).toBe('BWA/26-27/0031');
  });

  it('keeps invoice numbers within 16 characters (GST Rule 46)', () => {
    expect(nextNumber('invoice', data, '2026-10-01').length).toBeLessThanOrEqual(16);
  });
});
