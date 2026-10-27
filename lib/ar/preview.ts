// What a new invoice or credit note will be, worked out before it is saved. The forms show these
// as a live preview, and the server actions use the same functions to build the row they save.
import { nextNumber } from './numbering';
import { customerPositions } from './positions';
import { creditNoteGst, documentTotal, dueDate, gstSplit, type GstSplit } from './tax';
import type { ArData, Customer, Invoice, Paise } from './types';

export interface InvoicePreview {
  invoiceNo: string;
  dueDate: string;
  gst: GstSplit;
  total: Paise;
  balanceBefore: Paise; // the customer's net balance as at the invoice date, without this invoice
  balanceAfter: Paise;
  creditLimit: Paise;
  overLimit: boolean; // R9: warn, but do not block
}

/** R2, R3, R4 and R9 for a new invoice. */
export function previewInvoice(data: ArData, customer: Customer, invoiceDate: string, taxable: Paise, ratePct: number): InvoicePreview {
  const gst = gstSplit(customer.state, taxable, ratePct);
  const total = documentTotal(taxable, gst);
  const balanceBefore = customerPositions(data, invoiceDate).find((p) => p.customer.id === customer.id)?.netBalance ?? 0;
  const balanceAfter = balanceBefore + total;
  return {
    invoiceNo: nextNumber('invoice', data, invoiceDate),
    dueDate: dueDate(invoiceDate, customer.creditDays),
    gst,
    total,
    balanceBefore,
    balanceAfter,
    creditLimit: customer.creditLimit,
    overLimit: balanceAfter > customer.creditLimit,
  };
}

/**
 * R6 + R7: how much more can be allocated or credited to an invoice: its total less every
 * allocation and credit note against it, whatever their dates. Zero for a cancelled invoice.
 * The full total means nothing has been received or credited, so it may be cancelled (R8).
 */
export function creditableAmount(data: ArData, invoiceId: number): Paise {
  const invoice = data.invoices.find((i) => i.id === invoiceId);
  if (!invoice || invoice.isCancelled) return 0;
  let remaining = invoice.total;
  for (const a of data.allocations) if (a.invoiceId === invoiceId) remaining -= a.amount;
  for (const c of data.creditNotes) if (c.invoiceId === invoiceId) remaining -= c.total;
  return remaining;
}

/** R8: an invoice can be cancelled only if nothing has been allocated or credited against it. */
export function canCancel(data: ArData, invoice: Invoice): boolean {
  return !invoice.isCancelled && creditableAmount(data, invoice.id) === invoice.total;
}

export interface CreditNotePreview {
  creditNoteNo: string;
  gst: GstSplit;
  total: Paise;
  creditable: Paise;
  exceedsCreditable: boolean;
}

/** R4 + R7 for a new credit note against `invoice`. */
export function previewCreditNote(data: ArData, invoice: Invoice, creditNoteDate: string, taxable: Paise): CreditNotePreview {
  const gst = creditNoteGst(invoice, taxable);
  const total = documentTotal(taxable, gst);
  const creditable = creditableAmount(data, invoice.id);
  return {
    creditNoteNo: nextNumber('creditNote', data, creditNoteDate),
    gst,
    total,
    creditable,
    exceedsCreditable: total > creditable,
  };
}
