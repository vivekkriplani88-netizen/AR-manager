// CSV for Excel (section 4.12): a UTF-8 byte order mark so ₹ and names read correctly, plain
// amounts (70800.00, no ₹ or commas, written by the callers), and quotes around any field that
// contains a comma, a quote or a line break.

export type Cell = string | number | null;

export const BOM = '﻿';

export function csvField(value: Cell): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Cell[][]): string {
  return BOM + rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}

/** A route handler response that downloads `rows` as `filename`. */
export function csvResponse(filename: string, rows: Cell[][]): Response {
  return new Response(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
