import type { NextRequest } from 'next/server';
import { statement } from '@/lib/ar';
import { loadArData } from '@/lib/ar/load';
import { parseAsOf } from '@/lib/asof';
import { csvResponse } from '@/lib/csv';
import { statementCsvRows } from '@/lib/exports';
import { parseStatementQuery, statementFilename } from '@/lib/statement-query';

/** R15 statement as CSV: /statement/export?customer=…&from=…&to=… */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const data = await loadArData();
  const q = parseStatementQuery(params, data, parseAsOf(params.asof));
  if (!q.customer) return new Response('Choose a customer for the statement.', { status: 400 });
  if (q.error) return new Response(q.error, { status: 400 });

  const s = statement(data, q.customer.id, q.from, q.to);
  return csvResponse(statementFilename(q.customer, q.from, q.to), statementCsvRows(s));
}
