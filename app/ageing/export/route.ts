import type { NextRequest } from 'next/server';
import { dashboard } from '@/lib/ar';
import { loadArData } from '@/lib/ar/load';
import { parseAsOf } from '@/lib/asof';
import { csvResponse } from '@/lib/csv';
import { ageingCsvRows } from '@/lib/exports';

/** The ageing report (ageing by customer on the home screen) as CSV. */
export async function GET(request: NextRequest) {
  const asOf = parseAsOf(request.nextUrl.searchParams.get('asof'));
  return csvResponse(`Ageing_${asOf}.csv`, ageingCsvRows(dashboard(await loadArData(), asOf), asOf));
}
