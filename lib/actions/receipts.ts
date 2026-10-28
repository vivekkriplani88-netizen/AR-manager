'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { checkAllocations, nextNumber, unallocatedAmount } from '@/lib/ar';
import { loadArData } from '@/lib/ar/load';
import { isValidDate, withAsOf } from '@/lib/asof';
import { db } from '@/lib/db';
import { friendlyDbError } from '@/lib/db-errors';
import { formatDate, formatMoney } from '@/lib/format';
import { saveReceiptWithAllocations } from '@/lib/receipt-save';
import {
  ALLOCATE_FIELDS, RECEIPT_FIELDS, allocateSchema, readAllocations, receiptSchema, type AllocateFields, type ReceiptFields,
} from '@/lib/validation/receipt';

const rupees = (paise: number) => paise / 100;

export interface ReceiptFormState {
  values: ReceiptFields;
  allocations: Record<string, string>; // invoice id → amount as typed
  errors?: Partial<Record<keyof ReceiptFields, string[]>>;
  allocationErrors?: Record<string, string>;
  problems?: string[];
  message?: string;
}

/** Record a payment and its allocations together (R5, R6, section 4.8). */
export async function recordPayment(_prev: ReceiptFormState, formData: FormData): Promise<ReceiptFormState> {
  const values = Object.fromEntries(RECEIPT_FIELDS.map((f) => [f, String(formData.get(f) ?? '')])) as ReceiptFields;
  const asOf = String(formData.get('asof') ?? '');
  const alloc = readAllocations(formData);
  const back = { values, allocations: alloc.values };

  // 1. Validate.
  const parsed = receiptSchema.safeParse(values);
  if (!parsed.success || Object.keys(alloc.errors).length > 0) {
    return {
      ...back,
      errors: parsed.success ? undefined : z.flattenError(parsed.error).fieldErrors,
      allocationErrors: alloc.errors,
      message: 'Please correct the fields marked below.',
    };
  }
  const r = parsed.data;

  for (let attempt = 1; ; attempt++) {
    // 2. Business rules (R6), against fresh data.
    const data = await loadArData();
    const customer = data.customers.find((c) => c.id === r.customerId);
    if (!customer) return { ...back, errors: { customerId: ['This customer no longer exists.'] } };
    const problems = checkAllocations(
      data,
      { customerId: customer.id, receiptDate: r.receiptDate, allocationDate: r.receiptDate, available: r.bankAmount + r.tdsAmount },
      alloc.lines,
    );
    if (problems.length > 0) return { ...back, problems, message: 'The allocations cannot be saved as they are.' };

    // 3. Write the receipt and its allocations together; the receipt is removed again if the allocations fail.
    const receiptNo = nextNumber('receipt', data, r.receiptDate);
    const result = await saveReceiptWithAllocations(
      db,
      {
        receipt_no: receiptNo, customer_id: customer.id, receipt_date: r.receiptDate,
        bank_amount: rupees(r.bankAmount), tds_amount: rupees(r.tdsAmount), mode: r.mode, reference: r.reference,
      },
      alloc.lines.map((l) => ({ invoice_id: l.invoiceId, allocation_date: r.receiptDate, amount: rupees(l.amount) })),
    );

    if (!result.ok && result.stage === 'receipt' && result.error.code === '23505' && attempt === 1) continue; // number taken: retry once
    if (!result.ok && result.stage === 'receipt') return { ...back, message: friendlyDbError(result.error) };
    if (!result.ok) {
      return {
        ...back,
        message: result.rolledBack
          ? `The allocations could not be saved, so the payment was not recorded: ${friendlyDbError(result.error)}`
          : `Receipt ${receiptNo} was saved but its allocations were not (${friendlyDbError(result.error)}). Allocate it from the customer page, or delete it there.`,
      };
    }

    // 4. Refresh.
    revalidatePath('/', 'layout');
    redirect(withAsOf(`/customers/${customer.id}`, isValidDate(asOf) ? asOf : null));
  }
}

export interface AllocateFormState {
  values: AllocateFields;
  allocations: Record<string, string>;
  errors?: Partial<Record<keyof AllocateFields, string[]>>;
  allocationErrors?: Record<string, string>;
  problems?: string[];
  message?: string;
  saved?: string;
}

/** Allocate unapplied credit from an earlier receipt (R6). */
export async function allocateCredit(_prev: AllocateFormState, formData: FormData): Promise<AllocateFormState> {
  const values = Object.fromEntries(ALLOCATE_FIELDS.map((f) => [f, String(formData.get(f) ?? '')])) as AllocateFields;
  const alloc = readAllocations(formData);
  const back = { values, allocations: alloc.values };

  const parsed = allocateSchema.safeParse(values);
  if (!parsed.success || Object.keys(alloc.errors).length > 0) {
    return {
      ...back,
      errors: parsed.success ? undefined : z.flattenError(parsed.error).fieldErrors,
      allocationErrors: alloc.errors,
      message: 'Please correct the fields marked below.',
    };
  }
  if (alloc.lines.length === 0) return { ...back, message: 'Enter an amount against at least one invoice.' };
  const input = parsed.data;

  const data = await loadArData();
  const receipt = data.receipts.find((x) => x.id === input.receiptId);
  if (!receipt) return { ...back, message: 'This receipt no longer exists.' };
  const problems = checkAllocations(
    data,
    { customerId: receipt.customerId, receiptDate: receipt.receiptDate, allocationDate: input.allocationDate, available: unallocatedAmount(data, receipt.id) },
    alloc.lines,
  );
  if (problems.length > 0) return { ...back, problems, message: 'The allocations cannot be saved as they are.' };

  const { error } = await db.from('allocations').insert(
    alloc.lines.map((l) => ({ receipt_id: receipt.id, invoice_id: l.invoiceId, allocation_date: input.allocationDate, amount: rupees(l.amount) })),
  );
  if (error) return { ...back, message: friendlyDbError(error) };

  revalidatePath('/', 'layout');
  const total = alloc.lines.reduce((sum, l) => sum + l.amount, 0);
  return {
    values: { receiptId: '', allocationDate: input.allocationDate },
    allocations: {},
    saved: `${formatMoney(total)} from ${receipt.receiptNo} allocated on ${formatDate(input.allocationDate)}.`,
  };
}

export interface CorrectionState { message?: string }

/** Correction: remove one allocation. Its amount becomes unapplied credit on the receipt again. */
export async function removeAllocation(_prev: CorrectionState, formData: FormData): Promise<CorrectionState> {
  const id = Number(formData.get('id'));
  const { data, error } = await db.from('allocations').delete().eq('id', id).select('id');
  if (error) return { message: friendlyDbError(error) };
  if (data.length === 0) return { message: 'This allocation has already been removed.' };
  revalidatePath('/', 'layout');
  return {};
}

/** Correction: delete a receipt that has no allocations (the database refuses otherwise). */
export async function deleteReceipt(_prev: CorrectionState, formData: FormData): Promise<CorrectionState> {
  const id = Number(formData.get('id'));
  const data = await loadArData();
  const receipt = data.receipts.find((r) => r.id === id);
  if (!receipt) return { message: 'This receipt has already been deleted.' };
  const count = data.allocations.filter((a) => a.receiptId === id).length;
  if (count > 0) {
    return { message: `${receipt.receiptNo} still has ${count} allocation${count === 1 ? '' : 's'}. Remove them from the invoice pages first.` };
  }
  const { error } = await db.from('receipts').delete().eq('id', id);
  if (error) return { message: friendlyDbError(error) };
  revalidatePath('/', 'layout');
  return {};
}
