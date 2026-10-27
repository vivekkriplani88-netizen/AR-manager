'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { TaxLines } from '@/components/tax-lines';
import { isIntraState, previewInvoice, type ArData } from '@/lib/ar';
import { createInvoice, type InvoiceFormState } from '@/lib/actions/invoices';
import { isValidDate } from '@/lib/asof';
import { formatBalance, formatDate, formatMoney } from '@/lib/format';
import { parsePercent, parseRupees } from '@/lib/validation/fields';
import type { InvoiceFields } from '@/lib/validation/invoice';

const input = 'w-full rounded border border-zinc-300 px-2 py-1.5 aria-[invalid=true]:border-red-600';

/** Create an invoice, with a live preview of what will be saved (Part 2). */
export function InvoiceForm({ data, initial, asOf, cancelHref }: {
  data: ArData;
  initial: InvoiceFields;
  asOf: string | null;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState<InvoiceFormState, FormData>(createInvoice, { values: initial });
  const [v, setV] = useState<InvoiceFields>(initial);
  const set = (name: keyof InvoiceFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV({ ...v, [name]: e.target.value });

  const active = data.customers.filter((c) => c.isActive).sort((a, b) => a.code.localeCompare(b.code));
  const customer = active.find((c) => String(c.id) === v.customerId);
  const taxable = parseRupees(v.taxableValue);
  const rate = parsePercent(v.gstRatePct);
  const preview = customer && isValidDate(v.invoiceDate) && taxable !== null && taxable > 0 && rate !== null
    ? previewInvoice(data, customer, v.invoiceDate, taxable, rate)
    : null;

  const error = (name: keyof InvoiceFields) => state.errors?.[name]?.[0];
  const field = (name: keyof InvoiceFields, label: string, control: React.ReactNode, hint?: string) => (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
      {control}
      {hint && !error(name) && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
      {error(name) && <p className="mt-1 text-sm text-red-700">{error(name)}</p>}
    </div>
  );

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_22rem]" noValidate>
      {asOf && <input type="hidden" name="asof" value={asOf} />}

      <div className="space-y-4 rounded border border-zinc-200 bg-white p-6">
        {state.message && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{state.message}</p>}
        {field('customerId', 'Customer', (
          <select id="customerId" name="customerId" value={v.customerId} onChange={set('customerId')} aria-invalid={Boolean(error('customerId'))} className={input}>
            <option value="">Choose an active customer…</option>
            {active.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
        ), 'Inactive customers cannot be given new invoices.')}
        <div className="grid gap-4 sm:grid-cols-3">
          {field('invoiceDate', 'Invoice date', (
            <input id="invoiceDate" name="invoiceDate" type="date" value={v.invoiceDate} onChange={set('invoiceDate')} aria-invalid={Boolean(error('invoiceDate'))} className={input} />
          ))}
          {field('taxableValue', 'Taxable value (₹)', (
            <input id="taxableValue" name="taxableValue" inputMode="decimal" value={v.taxableValue} onChange={set('taxableValue')} aria-invalid={Boolean(error('taxableValue'))} className={input} placeholder="75,000.00" />
          ))}
          {field('gstRatePct', 'GST rate (%)', (
            <input id="gstRatePct" name="gstRatePct" inputMode="decimal" value={v.gstRatePct} onChange={set('gstRatePct')} aria-invalid={Boolean(error('gstRatePct'))} className={input} />
          ))}
        </div>
        {field('description', 'Description', (
          <textarea id="description" name="description" rows={2} value={v.description} onChange={set('description')} aria-invalid={Boolean(error('description'))} className={input} />
        ))}
        <div className="flex gap-3">
          <button type="submit" disabled={pending} className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50">
            {pending ? 'Saving…' : 'Create invoice'}
          </button>
          <Link href={cancelHref} className="rounded border border-zinc-300 px-4 py-2">Cancel</Link>
        </div>
      </div>

      <aside className="space-y-3 rounded border border-zinc-200 bg-white p-4" aria-live="polite">
        <h2 className="font-semibold">Preview</h2>
        {!preview ? (
          <p className="text-sm text-zinc-500">Choose a customer and enter the date and taxable value to see the tax, total, due date and number.</p>
        ) : (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-zinc-500">Number</dt><dd className="font-medium">{preview.invoiceNo}</dd>
              <dt className="text-zinc-500">Due date</dt><dd>{formatDate(preview.dueDate)} <span className="text-zinc-500">({customer!.creditDays} days)</span></dd>
              <dt className="text-zinc-500">Tax</dt><dd>{isIntraState(customer!.state) ? `CGST + SGST (${customer!.state})` : `IGST (${customer!.state})`}</dd>
            </dl>
            <TaxLines taxable={taxable!} gst={preview.gst} ratePct={rate!} total={preview.total} />
            <p className="text-xs text-zinc-500">The number is confirmed when the invoice is saved.</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-zinc-200 pt-3 text-sm">
              <dt className="text-zinc-500">Balance now</dt><dd className="tabular">{formatBalance(preview.balanceBefore)}</dd>
              <dt className="text-zinc-500">After this invoice</dt><dd className="tabular font-medium">{formatBalance(preview.balanceAfter)}</dd>
              <dt className="text-zinc-500">Credit limit</dt><dd className="tabular">{formatMoney(preview.creditLimit)}</dd>
            </dl>
            {preview.overLimit && (
              <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <strong>Over credit limit.</strong> This invoice takes {customer!.code}&apos;s net balance to {formatBalance(preview.balanceAfter)},
                above its limit of {formatMoney(preview.creditLimit)}. You can still create it.
              </p>
            )}
          </>
        )}
      </aside>
    </form>
  );
}
