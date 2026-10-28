import { z } from 'zod';
import { date, optionalDate, optionalPositiveRupees, recordId, requiredText } from './fields';

export const NOTE_TYPES = ['Call', 'Email', 'Meeting', 'Note'] as const;

export const NOTE_FIELDS = [
  'customerId', 'invoiceId', 'noteDate', 'noteType', 'body', 'followUpDate', 'promiseDate', 'promiseAmount',
] as const;
export type NoteFields = Record<(typeof NOTE_FIELDS)[number], string>;

/** R16, add a note. Whether the invoice belongs to the customer is checked against the data separately. */
export const noteSchema = z
  .object({
    customerId: recordId('Choose the customer.'),
    invoiceId: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d+$/.test(v), { error: 'Choose an invoice from the list, or none.' })
      .transform((v) => (v === '' ? null : Number(v))),
    noteDate: date('note date'),
    noteType: z.enum(NOTE_TYPES, { error: 'Choose the type of note.' }),
    body: requiredText('note', 2000),
    followUpDate: optionalDate('follow-up date'),
    promiseDate: optionalDate('promise date'),
    promiseAmount: optionalPositiveRupees('promised amount'),
  })
  .superRefine((n, ctx) => {
    // A promise to pay is a date and an amount, both or neither (R16).
    if (n.promiseDate !== null && n.promiseAmount === null) {
      ctx.addIssue({ code: 'custom', path: ['promiseAmount'], message: 'Enter the amount promised, or clear the promise date.' });
    }
    if (n.promiseDate === null && n.promiseAmount !== null) {
      ctx.addIssue({ code: 'custom', path: ['promiseDate'], message: 'Enter the date payment was promised by, or clear the amount.' });
    }
    if (n.followUpDate !== null && n.followUpDate < n.noteDate) {
      ctx.addIssue({ code: 'custom', path: ['followUpDate'], message: 'The follow-up date cannot be before the note date.' });
    }
    if (n.promiseDate !== null && n.promiseDate < n.noteDate) {
      ctx.addIssue({ code: 'custom', path: ['promiseDate'], message: 'The promise date cannot be before the note date.' });
    }
  });
