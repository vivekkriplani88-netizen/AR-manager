import { describe, expect, it } from 'vitest';
import { dso, followUpsDue, promiseStatuses } from '../lib/ar';
import { customer, loadSample, sample as data } from './fixture';

const promise = (code: string, noteDate: string, asOf: string) =>
  promiseStatuses(data, asOf).find((p) => p.note.customerId === customer(code).id && p.note.noteDate === noteDate);

describe('promiseStatuses (R16)', () => {
  it('C002 promise of 20-Jul (₹69,600 by 01-Aug): Pending up to its date, Broken after', () => {
    expect(promise('C002', '2026-07-20', '2026-07-31')!.status).toBe('Pending');
    expect(promise('C002', '2026-07-20', '2026-08-01')!.status).toBe('Pending');
    expect(promise('C002', '2026-07-20', '2026-08-02')!.status).toBe('Broken');
  });

  it('C002 promise of 02-Sep (₹94,400 by 10-Sep): Kept once RCT/26-27/0016 arrives on 09-Sep', () => {
    expect(promise('C002', '2026-09-02', '2026-09-08')).toMatchObject({ status: 'Pending', received: 0 });
    expect(promise('C002', '2026-09-02', '2026-09-09')).toMatchObject({ status: 'Kept', received: 9_440_000 });
    expect(promise('C002', '2026-09-02', '2026-10-31')!.status).toBe('Kept');
  });

  it('C003 promise of 10-Aug (₹2,34,200 by 30-Sep): Pending on 30-Sep, Broken on 01-Oct', () => {
    expect(promise('C003', '2026-08-10', '2026-09-30')!.status).toBe('Pending');
    expect(promise('C003', '2026-08-10', '2026-10-01')!.status).toBe('Broken');
  });

  it('ignores promises noted after the as-at date', () => {
    expect(promise('C002', '2026-09-02', '2026-09-01')).toBeUndefined();
    expect(promiseStatuses(data, '2026-08-31')).toHaveLength(2);
  });

  it('counts only receipts from the note date to the promise date', () => {
    // C002 paid on 15-Jun, before the 20-Jul promise, and next on 09-Sep, after 01-Aug.
    expect(promise('C002', '2026-07-20', '2026-10-31')).toMatchObject({ status: 'Broken', received: 0 });
  });
});

describe('followUpsDue (R16)', () => {
  const due = (asOf: string, d = data) => followUpsDue(d, asOf).map((n) => n.followUpDate).sort();

  it('lists open follow-ups dated on or before the as-at date', () => {
    expect(due('2026-08-31')).toEqual([]);
    expect(due('2026-09-01')).toEqual(['2026-09-01']);
    expect(due('2026-09-10')).toEqual(['2026-09-01', '2026-09-05', '2026-09-10']);
    expect(due('2026-09-15')).toEqual(['2026-09-01', '2026-09-05', '2026-09-10', '2026-09-15']);
  });

  it('drops follow-ups marked done', () => {
    const d = loadSample();
    d.notes.find((n) => n.followUpDate === '2026-09-01')!.followUpDone = true;
    expect(due('2026-09-10', d)).toEqual(['2026-09-05', '2026-09-10']);
  });
});

describe('dso (R17)', () => {
  it('is 111 days as at 31-Aug-2026 (worked out by hand)', () => {
    // Outstanding 21,18,100.00 ÷ net sales 03-Jun…31-Aug of 17,16,900.00 (17,46,400.00 invoiced
    // − 29,500.00 credit note; the cancelled BWA/26-27/0014 left out) × 90 = 111.03.
    expect(dso(data, '2026-08-31')).toBe(111);
  });

  it('is null when there are no sales in the window', () => {
    expect(dso(data, '2025-12-31')).toBeNull();
  });
});
