import type { ArData, Note, Paise } from './types';

export type PromiseStatus = 'Kept' | 'Broken' | 'Pending';

export interface PromiseToPay {
  note: Note;
  promiseDate: string;
  promiseAmount: Paise;
  received: Paise; // settlement value received from note_date to min(promise_date, asOf)
  status: PromiseStatus;
}

/** R16: every promise to pay noted on or before asOf, with its status. */
export function promiseStatuses(data: ArData, asOf: string): PromiseToPay[] {
  const result: PromiseToPay[] = [];
  for (const note of data.notes) {
    if (note.noteDate > asOf || note.promiseDate === null || note.promiseAmount === null) continue;
    const until = note.promiseDate < asOf ? note.promiseDate : asOf;
    let received = 0;
    for (const r of data.receipts) {
      if (r.customerId === note.customerId && r.receiptDate >= note.noteDate && r.receiptDate <= until) {
        received += r.bankAmount + r.tdsAmount;
      }
    }
    const status: PromiseStatus =
      received >= note.promiseAmount ? 'Kept' : note.promiseDate < asOf ? 'Broken' : 'Pending';
    result.push({ note, promiseDate: note.promiseDate, promiseAmount: note.promiseAmount, received, status });
  }
  return result;
}

/** R16: open follow-ups dated on or before asOf, from notes that exist by then (R10). */
export function followUpsDue(data: ArData, asOf: string): Note[] {
  return data.notes.filter(
    (n) => n.noteDate <= asOf && n.followUpDate !== null && n.followUpDate <= asOf && !n.followUpDone,
  );
}
