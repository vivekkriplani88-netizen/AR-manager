'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { canCancel, previewCreditNote, previewInvoice } from '@/lib/ar';
import { loadArData } from '@/lib/ar/load';
import { isValidDate, withAsOf } from '@/lib/asof';
import { db } from '@/lib/db';
import { friendlyDbError } from '@/lib/db-errors';
import { formatDate, formatMoney } from '@/lib/format';
import {
  CREDIT_NOTE_FIELDS, INVOICE_FIELDS, creditNoteSchema, invoiceSchema, type CreditNoteFields, type InvoiceFields,
} from '@/lib/validation/invoice';

const DUPLICATE = '23505';
const rupees = (paise: number) => paise / 100;

export interface InvoiceFormState {
  values: InvoiceFields;
  errors?: Partial<Record<keyof InvoiceFields, string[]>>;
  message?: string;
}

/** Create an invoice (R2, R3, R4, R9). The number, due date, GST and total are worked out here, not taken from the form. */
export async function createInvoice(_prev: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const values = Object.fromEntries(INVOICE_FIELDS.map((f) => [f, String(formData.get(f) ?? '')])) as InvoiceFields;
  const asOf = String(formData.get('asof') ?? '');

  const parsed = invoiceSchema.safeParse(values);
  if (!parsed.success) {
    return { values, errors: z.flattenError(parsed.error).fieldErrors, message: 'Please correct the fields marked below.' };
  }
  const input = parsed.data;

  // Try twice: if another tab takes the same number first, the insert fails as a duplicate,
  // so reload, work the number out again and retry once (section 4.8).
  for (let attempt = 1; ; attempt++) {
    const data = await loadArData();
    const customer = data.customers.find((c) => c.id === input.customerId);
    if (!customer) return { values, errors: { customerId: ['This customer no longer exists.'] } };
    if (!customer.isActive) {
      return { values, errors: { customerId: [`${customer.code} is inactive, so it cannot be given new invoices. Reactivate it first.`] } };
    }

    const p = previewInvoice(data, customer, input.invoiceDate, input.taxableValue, input.gstRatePct);
    if (p.invoiceNo.length > 16) return { values, message: `Invoice number ${p.invoiceNo} would be longer than 16 characters.` };

    const { data: saved, error } = await db.from('invoices').insert({
      invoice_no: p.invoiceNo, customer_id: customer.id, invoice_date: input.invoiceDate, due_date: p.dueDate,
      description: input.description, taxable_value: rupees(input.taxableValue), gst_rate_pct: input.gstRatePct,
      cgst: rupees(p.gst.cgst), sgst: rupees(p.gst.sgst), igst: rupees(p.gst.igst), total: rupees(p.total),
      is_cancelled: false, is_disputed: false,
    }).select('id').single();

    if (error?.code === DUPLICATE && attempt === 1) continue;
    if (error) return { values, message: friendlyDbError(error) };

    revalidatePath('/', 'layout');
    redirect(withAsOf(`/invoices/${saved.id}`, isValidDate(asOf) ? asOf : null));
  }
}

export interface CreditNoteFormState {
  values: CreditNoteFields;
  errors?: Partial<Record<keyof CreditNoteFields, string[]>>;
  message?: string;
  saved?: string; // a confirmation, after a successful save
}

/** Raise a credit note against an invoice (R4, R7). */
export async function createCreditNote(_prev: CreditNoteFormState, formData: FormData): Promise<CreditNoteFormState> {
  const values = Object.fromEntries(CREDIT_NOTE_FIELDS.map((f) => [f, String(formData.get(f) ?? '')])) as CreditNoteFields;
  const invoiceId = Number(formData.get('invoiceId'));

  const parsed = creditNoteSchema.safeParse(values);
  if (!parsed.success) {
    return { values, errors: z.flattenError(parsed.error).fieldErrors, message: 'Please correct the fields marked below.' };
  }
  const input = parsed.data;

  for (let attempt = 1; ; attempt++) {
    const data = await loadArData();
    const invoice = data.invoices.find((i) => i.id === invoiceId);
    if (!invoice) return { values, message: 'This invoice no longer exists.' };
    if (invoice.isCancelled) return { values, message: `${invoice.invoiceNo} is cancelled, so it cannot be credited.` };
    if (input.creditNoteDate < invoice.invoiceDate) {
      return { values, errors: { creditNoteDate: [`A credit note cannot be dated before its invoice (${formatDate(invoice.invoiceDate)}).`] } };
    }

    const p = previewCreditNote(data, invoice, input.creditNoteDate, input.taxableValue);
    if (p.exceedsCreditable) {
      return {
        values,
        errors: { taxableValue: [`This credit note totals ${formatMoney(p.total)} with GST, but only ${formatMoney(p.creditable)} of ${invoice.invoiceNo} has not been received or credited.`] },
      };
    }

    const { error } = await db.from('credit_notes').insert({
      credit_note_no: p.creditNoteNo, invoice_id: invoice.id, credit_note_date: input.creditNoteDate,
      taxable_value: rupees(input.taxableValue), cgst: rupees(p.gst.cgst), sgst: rupees(p.gst.sgst), igst: rupees(p.gst.igst),
      total: rupees(p.total), reason: input.reason,
    });

    if (error?.code === DUPLICATE && attempt === 1) continue;
    if (error) return { values, message: friendlyDbError(error) };

    revalidatePath('/', 'layout');
    return {
      values: { creditNoteDate: input.creditNoteDate, taxableValue: '', reason: '' },
      saved: `Credit note ${p.creditNoteNo} for ${formatMoney(p.total)} dated ${formatDate(input.creditNoteDate)} has been raised.`,
    };
  }
}

export interface InvoiceActionState { message?: string }

/** Set or clear the disputed flag. A label only: it changes no amount (R11). */
export async function setInvoiceDisputed(_prev: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  const id = Number(formData.get('id'));
  const disputed = formData.get('disputed') === 'true';
  const { data, error } = await db.from('invoices').update({ is_disputed: disputed }).eq('id', id).select('id');
  if (error) return { message: friendlyDbError(error) };
  if (data.length === 0) return { message: 'This invoice no longer exists.' };
  revalidatePath('/', 'layout');
  return {};
}

/** R8: cancel an invoice that nothing has been allocated or credited against. Its number is never reused. */
export async function cancelInvoice(_prev: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  const id = Number(formData.get('id'));
  const data = await loadArData();
  const invoice = data.invoices.find((i) => i.id === id);
  if (!invoice) return { message: 'This invoice no longer exists.' };
  if (invoice.isCancelled) return { message: `${invoice.invoiceNo} is already cancelled.` };
  if (!canCancel(data, invoice)) {
    return { message: `${invoice.invoiceNo} has payments or credit notes against it, so it cannot be cancelled. Remove its allocations first, or raise a credit note instead.` };
  }
  const { error } = await db.from('invoices').update({ is_cancelled: true }).eq('id', id);
  if (error) return { message: friendlyDbError(error) };
  revalidatePath('/', 'layout');
  return {};
}
