import type { ArData, NoteType, ReceiptMode } from './types';

// Rows as the database returns them (section 3.3): snake_case columns, amounts in rupees.
interface CustomerRow {
  id: number; code: string; name: string; city: string; state: string;
  contact_person: string; email: string; phone: string | null; gstin: string | null;
  credit_days: number; credit_limit: number; tds_rate_pct: number; is_active: boolean;
}
interface InvoiceRow {
  id: number; invoice_no: string; customer_id: number; invoice_date: string; due_date: string;
  description: string; taxable_value: number; gst_rate_pct: number;
  cgst: number; sgst: number; igst: number; total: number; is_cancelled: boolean; is_disputed: boolean;
}
interface CreditNoteRow {
  id: number; credit_note_no: string; invoice_id: number; credit_note_date: string;
  taxable_value: number; cgst: number; sgst: number; igst: number; total: number; reason: string;
}
interface ReceiptRow {
  id: number; receipt_no: string; customer_id: number; receipt_date: string;
  bank_amount: number; tds_amount: number; mode: ReceiptMode; reference: string | null;
}
interface AllocationRow { id: number; receipt_id: number; invoice_id: number; allocation_date: string; amount: number }
interface NoteRow {
  id: number; customer_id: number; invoice_id: number | null; note_date: string; note_type: NoteType; body: string;
  follow_up_date: string | null; follow_up_done: boolean; promise_date: string | null; promise_amount: number | null;
}

export interface DbTables {
  customers: CustomerRow[];
  invoices: InvoiceRow[];
  credit_notes: CreditNoteRow[];
  receipts: ReceiptRow[];
  allocations: AllocationRow[];
  notes: NoteRow[];
}

export const paise = (rupees: number) => Math.round(rupees * 100);

/**
 * Converts database rows to ArData: camelCase names, every amount in whole paise.
 * The only place amounts are converted on the way in. Shared by the loader and the tests.
 */
export function toArData(t: DbTables): ArData {
  return {
    customers: t.customers.map((r) => ({
      id: r.id, code: r.code, name: r.name, city: r.city, state: r.state,
      contactPerson: r.contact_person, email: r.email, phone: r.phone, gstin: r.gstin,
      creditDays: r.credit_days, creditLimit: paise(r.credit_limit), tdsRatePct: Number(r.tds_rate_pct),
      isActive: r.is_active,
    })),
    invoices: t.invoices.map((r) => ({
      id: r.id, invoiceNo: r.invoice_no, customerId: r.customer_id,
      invoiceDate: r.invoice_date, dueDate: r.due_date, description: r.description,
      taxableValue: paise(r.taxable_value), gstRatePct: Number(r.gst_rate_pct),
      cgst: paise(r.cgst), sgst: paise(r.sgst), igst: paise(r.igst), total: paise(r.total),
      isCancelled: r.is_cancelled, isDisputed: r.is_disputed,
    })),
    creditNotes: t.credit_notes.map((r) => ({
      id: r.id, creditNoteNo: r.credit_note_no, invoiceId: r.invoice_id, creditNoteDate: r.credit_note_date,
      taxableValue: paise(r.taxable_value), cgst: paise(r.cgst), sgst: paise(r.sgst), igst: paise(r.igst),
      total: paise(r.total), reason: r.reason,
    })),
    receipts: t.receipts.map((r) => ({
      id: r.id, receiptNo: r.receipt_no, customerId: r.customer_id, receiptDate: r.receipt_date,
      bankAmount: paise(r.bank_amount), tdsAmount: paise(r.tds_amount), mode: r.mode, reference: r.reference,
    })),
    allocations: t.allocations.map((r) => ({
      id: r.id, receiptId: r.receipt_id, invoiceId: r.invoice_id,
      allocationDate: r.allocation_date, amount: paise(r.amount),
    })),
    notes: t.notes.map((r) => ({
      id: r.id, customerId: r.customer_id, invoiceId: r.invoice_id, noteDate: r.note_date,
      noteType: r.note_type, body: r.body,
      followUpDate: r.follow_up_date, followUpDone: r.follow_up_done,
      promiseDate: r.promise_date, promiseAmount: r.promise_amount === null ? null : paise(r.promise_amount),
    })),
  };
}
