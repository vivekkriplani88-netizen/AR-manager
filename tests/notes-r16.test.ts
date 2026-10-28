import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { followUpsDue, promiseStatuses } from '../lib/ar';
import type { Note, Receipt } from '../lib/ar';
import { noteSchema, type NoteFields } from '../lib/validation/note';
import { customer, loadSample } from './fixture';

/** Sample data plus one promise from C006 (which pays without TDS) and the receipts given. */
function withPromise(promise: { noteDate: string; promiseDate: string; amount: number }, receipts: { date: string; bank: number; tds?: number }[]) {
  const d = loadSample();
  const c006 = customer('C006', d);
  const note: Note = {
    id: -1, customerId: c006.id, invoiceId: null, noteDate: promise.noteDate, noteType: 'Call', body: 'test',
    followUpDate: null, followUpDone: false, promiseDate: promise.promiseDate, promiseAmount: promise.amount,
  };
  d.notes.push(note);
  receipts.forEach((r, i) => d.receipts.push({
    id: -10 - i, receiptNo: `RCT/26-27/09${i}`, customerId: c006.id, receiptDate: r.date,
    bankAmount: r.bank, tdsAmount: r.tds ?? 0, mode: 'UPI', reference: null,
  } satisfies Receipt));
  return (asOf: string) => promiseStatuses(d, asOf).find((p) => p.note.id === -1);
}

describe('promise status (R16)', () => {
  const promise = { noteDate: '2026-09-01', promiseDate: '2026-09-15', amount: 3_540_000 }; // ₹35,400 by 15-Sep

  it('is Kept when several receipts add up to the amount, counting TDS', () => {
    const at = withPromise(promise, [{ date: '2026-09-05', bank: 2_000_000 }, { date: '2026-09-12', bank: 1_340_000, tds: 200_000 }]);
    expect(at('2026-09-11')).toMatchObject({ status: 'Pending', received: 2_000_000 });
    expect(at('2026-09-12')).toMatchObject({ status: 'Kept', received: 3_540_000 });
  });

  it('counts a receipt on the note date and on the promise date', () => {
    expect(withPromise(promise, [{ date: '2026-09-01', bank: 3_540_000 }])('2026-09-30')!.status).toBe('Kept');
    expect(withPromise(promise, [{ date: '2026-09-15', bank: 3_540_000 }])('2026-09-30')!.status).toBe('Kept');
  });

  it('ignores receipts before the note and after the promise date', () => {
    const at = withPromise(promise, [{ date: '2026-08-31', bank: 3_540_000 }, { date: '2026-09-16', bank: 3_540_000 }]);
    expect(at('2026-09-15')).toMatchObject({ status: 'Pending', received: 0 }); // the promise date itself: not yet broken
    expect(at('2026-09-16')).toMatchObject({ status: 'Broken', received: 0 }); // paid a day late: still broken
  });

  it('is Broken when short, and says how much came in', () => {
    expect(withPromise(promise, [{ date: '2026-09-10', bank: 3_539_999 }])('2026-09-20')).toMatchObject({ status: 'Broken', received: 3_539_999 });
  });

  it('does not exist before its note date', () => {
    expect(withPromise(promise, [])('2026-08-31')).toBeUndefined();
  });
});

describe('follow-ups due (R16)', () => {
  it('stays due until marked done, and is due again when reopened', () => {
    const d = loadSample();
    const note = d.notes.find((n) => n.followUpDate === '2026-09-01')!;
    expect(followUpsDue(d, '2026-09-01').map((n) => n.id)).toContain(note.id);
    note.followUpDone = true;
    expect(followUpsDue(d, '2026-10-31').map((n) => n.id)).not.toContain(note.id);
    note.followUpDone = false;
    expect(followUpsDue(d, '2026-10-31').map((n) => n.id)).toContain(note.id);
  });
});

describe('noteSchema', () => {
  const valid: NoteFields = {
    customerId: '5', invoiceId: '', noteDate: '2026-10-28', noteType: 'Call', body: 'Spoke to payables.',
    followUpDate: '', promiseDate: '', promiseAmount: '',
  };
  const errors = (overrides: Partial<NoteFields>) => {
    const r = noteSchema.safeParse({ ...valid, ...overrides });
    return r.success ? {} : z.flattenError(r.error).fieldErrors;
  };

  it('accepts a plain note, with blanks as nulls', () => {
    expect(noteSchema.parse(valid)).toEqual({
      customerId: 5, invoiceId: null, noteDate: '2026-10-28', noteType: 'Call', body: 'Spoke to payables.',
      followUpDate: null, promiseDate: null, promiseAmount: null,
    });
  });

  it('accepts a follow-up and a promise, in paise', () => {
    expect(noteSchema.parse({ ...valid, invoiceId: '12', followUpDate: '2026-11-02', promiseDate: '2026-11-10', promiseAmount: '69,600' }))
      .toMatchObject({ invoiceId: 12, followUpDate: '2026-11-02', promiseDate: '2026-11-10', promiseAmount: 6_960_000 });
  });

  it('needs the promise date and amount together', () => {
    expect(errors({ promiseDate: '2026-11-10' }).promiseAmount).toBeDefined();
    expect(errors({ promiseAmount: '5000' }).promiseDate).toBeDefined();
  });

  it('refuses dates before the note, and other bad input', () => {
    expect(errors({ followUpDate: '2026-10-27' }).followUpDate).toBeDefined();
    expect(errors({ promiseDate: '2026-10-27', promiseAmount: '5000' }).promiseDate).toBeDefined();
    expect(Object.keys(errors({ noteType: 'Fax', body: ' ', promiseDate: '2026-11-31', promiseAmount: '0' })).sort())
      .toEqual(['body', 'noteType', 'promiseAmount', 'promiseDate']);
  });
});
