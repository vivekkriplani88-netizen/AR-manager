import { z } from 'zod';
import type { AllocationLine } from '../ar';
import { date, optionalText, parseRupees, recordId, rupees } from './fields';

export const RECEIPT_MODES = ['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque'] as const;

export const RECEIPT_FIELDS = ['customerId', 'receiptDate', 'bankAmount', 'tdsAmount', 'mode', 'reference'] as const;
export type ReceiptFields = Record<(typeof RECEIPT_FIELDS)[number], string>;

/** Part 2, record a payment. The allocations are read and checked separately. */
export const receiptSchema = z
  .object({
    customerId: recordId('Choose the customer.'),
    receiptDate: date('receipt date'),
    bankAmount: rupees('bank amount'),
    tdsAmount: rupees('TDS amount'),
    mode: z.enum(RECEIPT_MODES, { error: 'Choose how the payment was made.' }),
    reference: optionalText('reference', 100),
  })
  .refine((r) => r.bankAmount + r.tdsAmount > 0, { error: 'Enter the amount received.', path: ['bankAmount'] });

export const ALLOCATE_FIELDS = ['receiptId', 'allocationDate'] as const;
export type AllocateFields = Record<(typeof ALLOCATE_FIELDS)[number], string>;

/** Allocate unapplied credit from an earlier receipt. */
export const allocateSchema = z.object({
  receiptId: recordId('Choose the receipt to allocate from.'),
  allocationDate: date('allocation date'),
});

/** Prefix of the form fields that carry an allocation: alloc_<invoice id> = amount in rupees. */
export const ALLOC_PREFIX = 'alloc_';

/**
 * Reads the allocation amounts from a form. Blank or zero means no allocation to that invoice.
 * Returns the lines, the raw text (to show the form again) and a message for any amount that is not one.
 */
export function readAllocations(formData: FormData): { lines: AllocationLine[]; values: Record<string, string>; errors: Record<string, string> } {
  const lines: AllocationLine[] = [];
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith(ALLOC_PREFIX) || typeof raw !== 'string') continue;
    const id = key.slice(ALLOC_PREFIX.length);
    if (!/^\d+$/.test(id)) continue;
    values[id] = raw;
    if (raw.trim() === '') continue;
    const amount = parseRupees(raw);
    if (amount === null) errors[id] = 'Enter an amount in rupees, or leave it blank.';
    else if (amount > 0) lines.push({ invoiceId: Number(id), amount });
  }
  return { lines, values, errors };
}
