'use client';

import type { OpenInvoice } from '@/lib/ar';
import { formatDate, formatMoney } from '@/lib/format';
import { ALLOC_PREFIX } from '@/lib/validation/receipt';

/** The open invoices of a customer, oldest first, each with an amount to allocate. */
export function AllocationTable({ open, amounts, onChange, errors = {} }: {
  open: OpenInvoice[];
  amounts: Record<string, string>;
  onChange: (invoiceId: number, value: string) => void;
  errors?: Record<string, string>;
}) {
  if (open.length === 0) return <p className="text-sm text-zinc-500">No open invoices dated on or before this date. Anything received stays as unapplied credit.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full text-sm">
        <thead className="border-b border-zinc-200"><tr>
          <th className="p-2 text-left font-medium">Invoice</th>
          <th className="p-2 text-left font-medium">Invoice date</th>
          <th className="p-2 text-left font-medium">Due date</th>
          <th className="p-2 text-right font-medium">Total</th>
          <th className="p-2 text-right font-medium">Left to settle</th>
          <th className="p-2 text-right font-medium">Allocate (₹)</th>
        </tr></thead>
        <tbody>
          {open.map(({ invoice, remaining }) => {
            const id = String(invoice.id);
            return (
              <tr key={id} className="border-b border-zinc-100 last:border-0">
                <td className="p-2 whitespace-nowrap font-medium">
                  {invoice.invoiceNo}
                  {invoice.isDisputed && <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800">Disputed</span>}
                </td>
                <td className="p-2 whitespace-nowrap">{formatDate(invoice.invoiceDate)}</td>
                <td className="p-2 whitespace-nowrap">{formatDate(invoice.dueDate)}</td>
                <td className="p-2 text-right whitespace-nowrap">{formatMoney(invoice.total)}</td>
                <td className="p-2 text-right whitespace-nowrap">{formatMoney(remaining)}</td>
                <td className="p-2 text-right">
                  <input
                    name={`${ALLOC_PREFIX}${id}`}
                    aria-label={`Amount to allocate to ${invoice.invoiceNo}`}
                    inputMode="decimal"
                    value={amounts[id] ?? ''}
                    onChange={(e) => onChange(invoice.id, e.target.value)}
                    aria-invalid={Boolean(errors[id])}
                    className="w-32 rounded border border-zinc-300 px-2 py-1 text-right aria-[invalid=true]:border-red-600"
                  />
                  {errors[id] && <p className="mt-1 text-xs text-red-700">{errors[id]}</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
