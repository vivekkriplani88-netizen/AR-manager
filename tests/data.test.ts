import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { paise, toArData, type DbTables } from '../lib/ar/convert';

const raw = readFileSync(new URL('./fixtures/sample.json', import.meta.url), 'utf8');
const data = toArData(JSON.parse(raw) as DbTables);

const invoice = (no: string) => data.invoices.find((i) => i.invoiceNo === no)!;

describe('sample fixture', () => {
  it('has every row of the sample data', () => {
    expect(data.customers).toHaveLength(8);
    expect(data.invoices).toHaveLength(29);
    expect(data.creditNotes).toHaveLength(1);
    expect(data.receipts).toHaveLength(17);
    expect(data.allocations).toHaveLength(18);
    expect(data.notes).toHaveLength(7);
  });

  it('never contains the workspace id', () => {
    expect(raw).not.toContain('workspace_id');
  });
});

describe('toArData', () => {
  it('converts every amount to whole paise', () => {
    const all = [
      ...data.customers.map((c) => c.creditLimit),
      ...data.invoices.flatMap((i) => [i.taxableValue, i.cgst, i.sgst, i.igst, i.total]),
      ...data.creditNotes.flatMap((c) => [c.taxableValue, c.cgst, c.sgst, c.igst, c.total]),
      ...data.receipts.flatMap((r) => [r.bankAmount, r.tdsAmount]),
      ...data.allocations.map((a) => a.amount),
      ...data.notes.flatMap((n) => (n.promiseAmount === null ? [] : [n.promiseAmount])),
    ];
    for (const amount of all) expect(Number.isInteger(amount)).toBe(true);
  });

  it('reads BWA/26-27/0001 as in spot check 1', () => {
    const i = invoice('BWA/26-27/0001');
    expect(i).toMatchObject({ cgst: 675000, sgst: 675000, igst: 0, total: 8850000, dueDate: '2026-05-05' });
  });

  it('reads BWA/26-27/0002 as in spot check 2', () => {
    expect(invoice('BWA/26-27/0002')).toMatchObject({ igst: 6300000, total: 41300000 });
  });

  it('keeps the cancelled and disputed flags', () => {
    expect(invoice('BWA/26-27/0014').isCancelled).toBe(true);
    expect(invoice('BWA/26-27/0010').isDisputed).toBe(true);
  });

  it('maps optional note fields to null', () => {
    const advance = data.notes.find((n) => n.noteDate === '2026-07-10')!;
    expect(advance).toMatchObject({ invoiceId: null, followUpDate: null, promiseDate: null, promiseAmount: null });
    const promise = data.notes.find((n) => n.noteDate === '2026-07-20')!;
    expect(promise).toMatchObject({ promiseDate: '2026-08-01', promiseAmount: 6960000 });
  });

  it('rounds rupee amounts that are not exact in binary', () => {
    expect(paise(0.29)).toBe(29); // 0.29 * 100 is 28.999999999999996
    expect(paise(1234.57)).toBe(123457);
  });
});
