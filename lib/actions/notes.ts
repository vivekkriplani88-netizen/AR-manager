'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { loadArData } from '@/lib/ar/load';
import { isValidDate } from '@/lib/asof';
import { db } from '@/lib/db';
import { friendlyDbError } from '@/lib/db-errors';
import { formatDate } from '@/lib/format';
import { NOTE_FIELDS, noteSchema, type NoteFields } from '@/lib/validation/note';

export interface NoteFormState {
  values: NoteFields;
  errors?: Partial<Record<keyof NoteFields, string[]>>;
  message?: string;
  saved?: string; // a confirmation; a new value each time, so the form can start afresh
}

/** Add a note, with an optional invoice, follow-up and promise to pay (R16). */
export async function addNote(_prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const values = Object.fromEntries(NOTE_FIELDS.map((f) => [f, String(formData.get(f) ?? '')])) as NoteFields;
  const asOf = String(formData.get('asof') ?? '');

  const parsed = noteSchema.safeParse(values);
  if (!parsed.success) {
    return { values, errors: z.flattenError(parsed.error).fieldErrors, message: 'Please correct the fields marked below.' };
  }
  const n = parsed.data;

  const data = await loadArData();
  if (!data.customers.some((c) => c.id === n.customerId)) return { values, message: 'This customer no longer exists.' };
  if (n.invoiceId !== null) {
    const invoice = data.invoices.find((i) => i.id === n.invoiceId);
    if (!invoice || invoice.customerId !== n.customerId) {
      return { values, errors: { invoiceId: ['Choose one of this customer’s invoices, or none.'] } };
    }
    if (invoice.invoiceDate > n.noteDate) {
      return { values, errors: { invoiceId: [`${invoice.invoiceNo} is dated ${formatDate(invoice.invoiceDate)}, after this note.`] } };
    }
  }

  const { error } = await db.from('notes').insert({
    customer_id: n.customerId, invoice_id: n.invoiceId, note_date: n.noteDate, note_type: n.noteType, body: n.body,
    follow_up_date: n.followUpDate, follow_up_done: false,
    promise_date: n.promiseDate, promise_amount: n.promiseAmount === null ? null : n.promiseAmount / 100,
  });
  if (error) return { values, message: friendlyDbError(error) };

  revalidatePath('/', 'layout');
  const later = isValidDate(asOf) && n.noteDate > asOf
    ? ` It is dated after the as-at date (${formatDate(asOf)}), so it shows from ${formatDate(n.noteDate)}.` : '';
  return {
    values: { ...values, body: '', followUpDate: '', promiseDate: '', promiseAmount: '' },
    saved: `${n.noteType} note of ${formatDate(n.noteDate)} added.${later}`,
  };
}

export interface FollowUpState { message?: string }

/** Mark a follow-up done, or open it again. */
export async function setFollowUpDone(_prev: FollowUpState, formData: FormData): Promise<FollowUpState> {
  const id = Number(formData.get('id'));
  const done = formData.get('done') === 'true';
  const { data, error } = await db.from('notes').update({ follow_up_done: done }).eq('id', id).select('id');
  if (error) return { message: friendlyDbError(error) };
  if (data.length === 0) return { message: 'This note no longer exists.' };
  revalidatePath('/', 'layout');
  return {};
}
