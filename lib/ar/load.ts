import 'server-only';
import { db } from '@/lib/db';
import { toArData } from './convert';
import type { ArData } from './types';

/** Loads all six tables on every request; every calculation then runs in memory (section 4.5). */
export async function loadArData(): Promise<ArData> {
  const [customers, invoices, creditNotes, receipts, allocations, notes] = await Promise.all([
    db.from('customers').select('*').order('id'),
    db.from('invoices').select('*').order('id'),
    db.from('credit_notes').select('*').order('id'),
    db.from('receipts').select('*').order('id'),
    db.from('allocations').select('*').order('id'),
    db.from('notes').select('*').order('id'),
  ]);
  for (const r of [customers, invoices, creditNotes, receipts, allocations, notes]) {
    if (r.error) throw new Error(r.error.message);
  }

  return toArData({
    customers: customers.data!,
    invoices: invoices.data!,
    credit_notes: creditNotes.data!,
    receipts: receipts.data!,
    allocations: allocations.data!,
    notes: notes.data!,
  });
}
