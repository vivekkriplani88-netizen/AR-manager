// Turns database errors into plain language (section 4.6). The database's own messages are
// already readable ("Invoice … has only 3000.00 outstanding."), so those pass through; codes and
// constraint names are translated.

interface DbError { code?: string; message: string }

const CONSTRAINTS: Record<string, string> = {
  customers_workspace_id_code_key: 'Another customer already uses this code.',
  total_equals_taxable_plus_gst: 'The total does not equal the taxable value plus GST.',
};

export function friendlyDbError(error: DbError): string {
  for (const [name, text] of Object.entries(CONSTRAINTS)) if (error.message.includes(`"${name}"`)) return text;
  if (error.code === '23505') return 'That code or number is already in use. Refresh the page and try again.';
  if (error.code === '23514') return 'The database rejected these values as inconsistent. Check the amounts and try again.';
  if (error.code === '42501' || /permission denied/i.test(error.message)) return 'The database does not allow this change.';
  if (/fetch failed|network/i.test(error.message)) return 'Could not reach the database. Check the connection and try again.';
  return error.message;
}
