import { createClient } from '@supabase/supabase-js';

/**
 * Deployment check: is each environment variable present and clean, and does the database answer
 * for this workspace? Reports only presence, lengths and shapes, never the values. Creates its own
 * client so it can report a missing variable instead of failing with it.
 */
export async function GET() {
  const names = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'AR_WORKSPACE_ID'] as const;
  const variables = Object.fromEntries(
    names.map((name) => {
      const value = process.env[name];
      return [name, value === undefined || value === ''
        ? { set: false }
        : { set: true, length: value.length, noSpaces: value === value.trim(), noQuotes: !/^["']|["']$/.test(value.trim()) }];
    }),
  );
  const url = process.env.SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_ANON_KEY ?? '';
  const workspace = process.env.AR_WORKSPACE_ID ?? '';
  const hide = (text: string) => [workspace, key].filter(Boolean).reduce((t, secret) => t.split(secret).join('[hidden]'), text);

  let database: { ok: boolean; customers?: number | null; message?: string };
  try {
    const db = createClient(url, key, {
      auth: { persistSession: false },
      global: { headers: { 'x-workspace': workspace } },
    });
    const { count, error } = await db.from('customers').select('id', { count: 'exact', head: true });
    database = error ? { ok: false, message: hide(error.message || JSON.stringify(error)) } : { ok: true, customers: count };
  } catch (e) {
    database = { ok: false, message: hide(e instanceof Error ? e.message : String(e)) };
  }

  return Response.json(
    {
      variables,
      supabaseHost: (() => { try { return new URL(url.trim()).host; } catch { return null; } })(),
      workspaceIdShape: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspace),
      database,
    },
    { status: database.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
