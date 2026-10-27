// Saves the six tables to tests/fixtures/sample.json so the tests run offline (section 4.14).
// Reset the workspace first, then run: node --env-file=.env.local scripts/snapshot.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const TABLES = ['customers', 'invoices', 'credit_notes', 'receipts', 'allocations', 'notes'];

// workspace_id is private (section 4.9) and this file is committed, so it is never written.
const OMIT = new Set(['workspace_id', 'created_at']);

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
  global: { headers: { 'x-workspace': process.env.AR_WORKSPACE_ID! } },
});

const snapshot: Record<string, unknown[]> = {};
for (const t of TABLES) {
  const { data, error } = await db.from(t).select('*').order('id');
  if (error) throw new Error(`${t}: ${error.message}`);
  snapshot[t] = data.map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => !OMIT.has(k))));
  console.log(`${t}: ${data.length} rows`);
}

mkdirSync('tests/fixtures', { recursive: true });
writeFileSync('tests/fixtures/sample.json', JSON.stringify(snapshot, null, 2) + '\n');
console.log('Wrote tests/fixtures/sample.json');
