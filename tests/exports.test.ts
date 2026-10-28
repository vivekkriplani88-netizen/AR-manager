import { describe, expect, it } from 'vitest';
import { dashboard, fyStart, invoiceRows, invoiceTotals, statement } from '../lib/ar';
import { BOM, csvField, toCsv } from '../lib/csv';
import { ageingCsvRows, invoiceCsvRows, statementCsvRows } from '../lib/exports';
import { parseStatementQuery, statementFilename } from '../lib/statement-query';
import { customer, sample as data } from './fixture';

describe('CSV (section 4.12)', () => {
  it('quotes fields with commas, quotes or line breaks, and leaves the rest alone', () => {
    expect(csvField('Cost audit support, Q3')).toBe('"Cost audit support, Q3"');
    expect(csvField('He said "pay"')).toBe('"He said ""pay"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
    expect(csvField('70800.00')).toBe('70800.00');
    expect(csvField(null)).toBe('');
    expect(csvField(90)).toBe('90');
  });

  it('starts with a UTF-8 byte order mark and ends lines with CRLF', () => {
    expect(toCsv([['a', 'b'], ['c', null]])).toBe(`${BOM}a,b\r\nc,\r\n`);
    expect(BOM).toBe('﻿');
  });
});

describe('statement CSV (R15): C002, 01-Apr to 31-Aug-2026 (spot check 8)', () => {
  const rows = statementCsvRows(statement(data, customer('C002').id, '2026-04-01', '2026-08-31'));
  const csv = toCsv(rows);

  it('has the opening balance, the seven lines and the closing balance, as plain numbers', () => {
    const table = rows.slice(5, 14);
    expect(table[0]).toEqual(['2026-04-01', 'Opening balance', null, null, null, null, '70800.00', 'Dr']);
    expect(table.slice(1, 8).map((r) => [r[0], r[1], r[2], r[4], r[5], r[6]])).toEqual([
      ['2026-04-18', 'Invoice', 'BWA/26-27/0003', '141600.00', null, '212400.00'],
      ['2026-05-20', 'Payment', 'RCT/26-27/0005', null, '64800.00', '147600.00'],
      ['2026-05-20', 'TDS', 'RCT/26-27/0005', null, '6000.00', '141600.00'],
      ['2026-05-22', 'Invoice', 'BWA/26-27/0009', '94400.00', null, '236000.00'],
      ['2026-06-15', 'Payment', 'RCT/26-27/0007', null, '60000.00', '176000.00'],
      ['2026-06-15', 'TDS', 'RCT/26-27/0007', null, '12000.00', '164000.00'],
      ['2026-07-20', 'Invoice', 'BWA/26-27/0018', '59000.00', null, '223000.00'],
    ]);
    expect(table[8]).toEqual(['2026-08-31', 'Closing balance', null, null, null, null, '223000.00', 'Dr']);
  });

  it('ends with the closing balance by ageing (worked out by hand)', () => {
    // 0018 not due (due 03-Sep); 0009 (56 days) and 0003 (90 days) both 46–90.
    expect(rows.slice(-8)).toEqual([
      ['Not due', '59000.00'], ['1-15 days', '0.00'], ['16-30 days', '0.00'], ['31-45 days', '0.00'],
      ['46-90 days', '164000.00'], ['Over 90 days', '0.00'], ['Less unapplied credit', '0.00'], ['Closing balance', '223000.00', 'Dr'],
    ]);
  });

  it('never writes ₹ or Indian digit grouping', () => {
    expect(csv).not.toContain('₹');
    expect(csv).not.toMatch(/\d,\d{2},\d{3}/);
  });

  it('is named after the customer and period', () => {
    expect(statementFilename(customer('C002'), '2026-04-01', '2026-08-31')).toBe('Statement_C002_2026-04-01_to_2026-08-31.csv');
  });

  it('shows a credit balance as Cr (C005 on 12-Jul: the advance)', () => {
    const c005 = statementCsvRows(statement(data, customer('C005').id, '2026-07-01', '2026-07-12'));
    expect(c005.find((r) => r[1] === 'Closing balance')).toEqual(['2026-07-12', 'Closing balance', null, null, null, null, '-100000.00', 'Cr']);
    expect(c005.find((r) => r[0] === 'Less unapplied credit')).toEqual(['Less unapplied credit', '-100000.00']);
  });
});

describe('invoice list CSV', () => {
  const rows = invoiceRows(data, '2026-08-31');
  const csvRows = invoiceCsvRows(rows, invoiceTotals(rows), '2026-08-31');

  it('has a row per invoice and a totals row matching the screen', () => {
    expect(csvRows.length).toBe(3 + rows.length + 1);
    expect(csvRows.at(-1)).toEqual(['Total of 27 invoices (1 cancelled, not included)', null, null, null, null, '3929400.00', '1781800.00', '29500.00', '2118100.00']);
  });

  it('writes an overdue, part-paid invoice and a cancelled one', () => {
    expect(csvRows.find((r) => r[0] === 'BWA/26-27/0003')).toEqual([
      'BWA/26-27/0003', 'C002', 'Varandha Freight LLP', '2026-04-18', '2026-06-02', '141600.00', '72000.00', '0.00', '69600.00', 'Overdue', 'Yes', 'No', 90,
    ]);
    expect(csvRows.find((r) => r[0] === 'BWA/26-27/0014')!.slice(5, 10)).toEqual(['236000.00', null, null, null, 'Cancelled']);
  });

  it('quotes descriptions and names with commas when written out', () => {
    expect(toCsv(csvRows)).toContain('"Total of 27 invoices (1 cancelled, not included)"');
  });
});

describe('ageing CSV', () => {
  const rows = ageingCsvRows(dashboard(data, '2026-08-31'), '2026-08-31');

  it('keeps unapplied credit in its own column and totals every column', () => {
    expect(rows[2]).toEqual(['Customer code', 'Customer', 'Not due', '1-15 days', '16-30 days', '31-45 days', '46-90 days', 'Over 90 days', 'Outstanding', 'Unapplied credit', 'Net balance', 'Dr/Cr']);
    expect(rows.find((r) => r[0] === 'C005')).toEqual(['C005', 'Sabarmati Retail Ventures Pvt. Ltd.', '70800.00', '0.00', '118000.00', '0.00', '0.00', '0.00', '188800.00', '100000.00', '88800.00', 'Dr']);
    expect(rows.at(-1)).toEqual(['Total', null, '831900.00', '507400.00', '118000.00', '129800.00', '167000.00', '364000.00', '2118100.00', '100000.00', '2018100.00', 'Dr']);
  });
});

describe('statement period', () => {
  it('starts on 1 April of the financial year by default', () => {
    expect(fyStart('2026-08-31')).toBe('2026-04-01');
    expect(fyStart('2026-03-31')).toBe('2025-04-01');
    expect(fyStart('2026-04-01')).toBe('2026-04-01');
  });

  it('defaults To to the as-at date, and explains a bad period', () => {
    const c = customer('C002');
    expect(parseStatementQuery({ customer: String(c.id) }, data, '2026-08-31')).toMatchObject({ customer: c, from: '2026-04-01', to: '2026-08-31', error: null });
    expect(parseStatementQuery({ customer: String(c.id), from: '2026-09-01', to: '2026-08-31' }, data, '2026-08-31').error).toMatch(/starts .* after it ends/);
    expect(parseStatementQuery({ customer: '999999' }, data, '2026-08-31').error).toBe('That customer does not exist.');
    expect(parseStatementQuery({ customer: String(c.id), to: '2026-02-30' }, data, '2026-08-31').error).toBe('Enter the period as real dates.');
  });
});
