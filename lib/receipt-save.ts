// Saving a receipt and its allocations together (section 4.8). The API has no transactions across
// requests, so if the allocations cannot be saved, the receipt just created is deleted again.
// Takes the client as a parameter so the rollback can be tested without the real database.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DbError { code?: string; message: string }

export interface ReceiptRow {
  receipt_no: string; customer_id: number; receipt_date: string;
  bank_amount: number; tds_amount: number; mode: string; reference: string | null;
}
export interface AllocationRowInput { invoice_id: number; allocation_date: string; amount: number }

export type SaveResult =
  | { ok: true; receiptId: number }
  | { ok: false; stage: 'receipt'; error: DbError }
  | { ok: false; stage: 'allocations'; error: DbError; rolledBack: boolean };

export async function saveReceiptWithAllocations(
  db: SupabaseClient,
  receipt: ReceiptRow,
  allocations: AllocationRowInput[],
): Promise<SaveResult> {
  const { data: saved, error } = await db.from('receipts').insert(receipt).select('id').single();
  if (error) return { ok: false, stage: 'receipt', error };

  if (allocations.length > 0) {
    // All allocations in one insert: they are saved together or not at all.
    const { error: allocError } = await db
      .from('allocations')
      .insert(allocations.map((a) => ({ ...a, receipt_id: saved.id })));
    if (allocError) {
      const { error: deleteError } = await db.from('receipts').delete().eq('id', saved.id);
      return { ok: false, stage: 'allocations', error: allocError, rolledBack: !deleteError };
    }
  }
  return { ok: true, receiptId: saved.id };
}
