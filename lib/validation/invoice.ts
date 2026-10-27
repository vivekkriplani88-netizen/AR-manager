import { z } from 'zod';
import { date, percent, positiveRupees, recordId, requiredText } from './fields';

export const INVOICE_FIELDS = ['customerId', 'invoiceDate', 'description', 'taxableValue', 'gstRatePct'] as const;
export type InvoiceFields = Record<(typeof INVOICE_FIELDS)[number], string>;

/** Part 2, create invoice. Whether the customer is active is checked against the data separately. */
export const invoiceSchema = z.object({
  customerId: recordId('Choose the customer.'),
  invoiceDate: date('invoice date'),
  description: requiredText('description', 500),
  taxableValue: positiveRupees('taxable value'),
  gstRatePct: percent('GST rate'),
});

export const CREDIT_NOTE_FIELDS = ['creditNoteDate', 'taxableValue', 'reason'] as const;
export type CreditNoteFields = Record<(typeof CREDIT_NOTE_FIELDS)[number], string>;

/** R7, raise a credit note. Its date and amount are checked against the invoice separately. */
export const creditNoteSchema = z.object({
  creditNoteDate: date('credit note date'),
  taxableValue: positiveRupees('taxable value'),
  reason: requiredText('reason', 500),
});
