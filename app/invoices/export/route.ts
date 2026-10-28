import type { NextRequest } from 'next/server';
import { invoiceRows, invoiceTotals } from '@/lib/ar';
import { loadArData } from '@/lib/ar/load';
import { parseAsOf } from '@/lib/asof';
import { csvResponse } from '@/lib/csv';
import { invoiceCsvRows } from '@/lib/exports';
import { invoiceList, parseInvoiceListQuery } from '@/lib/invoice-list';

/** The invoice list as CSV, with the same filters and sort as the screen. */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const asOf = parseAsOf(params.asof);
  const rows = invoiceList(invoiceRows(await loadArData(), asOf), parseInvoiceListQuery(params));
  return csvResponse(`Invoices_${asOf}.csv`, invoiceCsvRows(rows, invoiceTotals(rows), asOf));
}
