'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { AllocationTable } from '@/components/allocation-table';
import {
  allocationSummary, expectedTds, nextNumber, openInvoices, suggestAllocations, type AllocationLine, type ArData,
} from '@/lib/ar';
import { recordPayment, type ReceiptFormState } from '@/lib/actions/receipts';
import { isValidDate } from '@/lib/asof';
import { formatMoney, toPlainRupees } from '@/lib/format';
import { parseRupees } from '@/lib/validation/fields';
import { RECEIPT_MODES, type ReceiptFields } from '@/lib/validation/receipt';

const input = 'w-full rounded border border-zinc-300 px-2 py-1.5 aria-[invalid=true]:border-red-600';

/** As typed in the allocation boxes, for the summary: blanks and non-amounts count as nothing. */
const typedLines = (amounts: Record<string, string>): AllocationLine[] =>
  Object.entries(amounts).map(([id, text]) => ({ invoiceId: Number(id), amount: parseRupees(text) ?? 0 }));

/**
 * Record a payment (Part 2, R5, R6). TDS is pre-filled from the customer's rate until edited; the
 * allocations follow the oldest-first suggestion until edited. Both can be reset.
 */
export function ReceiptForm({ data, initial, asOf, cancelHref }: {
  data: ArData;
  initial: ReceiptFields;
  asOf: string | null;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState<ReceiptFormState, FormData>(recordPayment, { values: initial, allocations: {} });
  const [v, setV] = useState<ReceiptFields>(initial);
  const [tdsEdited, setTdsEdited] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string> | null>(null); // null: follow the suggestion

  const customers = [...data.customers].sort((a, b) => a.code.localeCompare(b.code));
  const customer = customers.find((c) => String(c.id) === v.customerId);
  const open = customer && isValidDate(v.receiptDate) ? openInvoices(data, customer.id, v.receiptDate) : [];
  const bank = parseRupees(v.bankAmount);
  const autoTds = customer && bank !== null ? expectedTds(open, bank, customer.tdsRatePct) : null;
  const tdsText = !tdsEdited && autoTds !== null ? toPlainRupees(autoTds) : v.tdsAmount;
  const tds = parseRupees(tdsText);
  const settlement = (bank ?? 0) + (tds ?? 0);

  const suggested = Object.fromEntries(suggestAllocations(open, settlement).map((l) => [String(l.invoiceId), toPlainRupees(l.amount)]));
  const shown = amounts ?? suggested;
  const summary = allocationSummary(settlement, typedLines(shown));

  const change = (name: keyof ReceiptFields, value: string) => {
    setV({ ...v, [name]: value });
    if (name === 'customerId') { setTdsEdited(false); setAmounts(null); }
    if (name === 'receiptDate') setAmounts(null);
  };
  const error = (name: keyof ReceiptFields) => state.errors?.[name]?.[0];
  const field = (name: keyof ReceiptFields, label: string, control: React.ReactNode, hint?: React.ReactNode) => (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
      {control}
      {hint && !error(name) && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
      {error(name) && <p className="mt-1 text-sm text-red-700">{error(name)}</p>}
    </div>
  );

  return (
    <form action={action} className="space-y-6" noValidate>
      {asOf && <input type="hidden" name="asof" value={asOf} />}
      {state.message && (
        <div role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">
          <p>{state.message}</p>
          {state.problems && <ul className="mt-1 list-disc pl-5">{state.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        </div>
      )}

      <section className="grid gap-4 rounded border border-zinc-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
        {field('customerId', 'Customer', (
          <select id="customerId" name="customerId" value={v.customerId} onChange={(e) => change('customerId', e.target.value)} aria-invalid={Boolean(error('customerId'))} className={input}>
            <option value="">Choose a customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}{c.isActive ? '' : ' (inactive)'}</option>)}
          </select>
        ))}
        {field('receiptDate', 'Receipt date', (
          <input id="receiptDate" name="receiptDate" type="date" value={v.receiptDate} onChange={(e) => change('receiptDate', e.target.value)} aria-invalid={Boolean(error('receiptDate'))} className={input} />
        ), customer && isValidDate(v.receiptDate) ? <>Number {nextNumber('receipt', data, v.receiptDate)}, confirmed when saved. Allocations are dated the same day.</> : undefined)}
        {field('mode', 'Mode', (
          <select id="mode" name="mode" value={v.mode} onChange={(e) => change('mode', e.target.value)} aria-invalid={Boolean(error('mode'))} className={input}>
            {RECEIPT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        ))}
        {field('bankAmount', 'Bank amount (₹)', (
          <input id="bankAmount" name="bankAmount" inputMode="decimal" value={v.bankAmount} onChange={(e) => change('bankAmount', e.target.value)} aria-invalid={Boolean(error('bankAmount'))} className={input} placeholder="81,000.00" />
        ), 'What reached the bank.')}
        {field('tdsAmount', 'TDS deducted (₹)', (
          <input id="tdsAmount" name="tdsAmount" inputMode="decimal" value={tdsText} onChange={(e) => { setTdsEdited(true); change('tdsAmount', e.target.value); }} aria-invalid={Boolean(error('tdsAmount'))} className={input} />
        ), customer && (
          tdsEdited && autoTds !== null
            ? <>Expected {formatMoney(autoTds)} at {customer.tdsRatePct}%. <button type="button" className="underline" onClick={() => setTdsEdited(false)}>Use it</button></>
            : <>Expected at {customer.tdsRatePct}% of the taxable value settled. Change it to what the customer actually deducted.</>
        ))}
        {field('reference', 'Reference (optional)', (
          <input id="reference" name="reference" value={v.reference} onChange={(e) => change('reference', e.target.value)} className={input} placeholder="UTR or cheque number" />
        ))}
      </section>

      {customer && (
        <section className="space-y-3 rounded border border-zinc-200 bg-white p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Allocate to {customer.code}&apos;s open invoices</h2>
            {amounts !== null && (
              <button type="button" onClick={() => setAmounts(null)} className="text-sm underline">Suggest oldest first again</button>
            )}
          </div>
          <p className="text-xs text-zinc-500">Suggested oldest first, by due date then invoice number. Change any amount; blank means nothing to that invoice.</p>
          <AllocationTable
            open={open}
            amounts={shown}
            errors={state.allocationErrors}
            onChange={(id, value) => setAmounts({ ...shown, [String(id)]: value })}
          />
          <dl className="tabular flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-zinc-200 pt-3 text-sm">
            <div><dt className="inline text-zinc-500">Settlement (bank + TDS) </dt><dd className="inline font-medium">{formatMoney(settlement)}</dd></div>
            <div><dt className="inline text-zinc-500">Allocated </dt><dd className="inline font-medium">{formatMoney(summary.allocated)}</dd></div>
            <div>
              <dt className="inline text-zinc-500">Left as unapplied credit </dt>
              <dd className={`inline font-semibold ${summary.over ? 'text-red-700' : ''}`}>{formatMoney(summary.unapplied)}</dd>
            </div>
          </dl>
          {summary.over && <p role="alert" className="text-right text-sm text-red-700">The allocations add up to more than the settlement value.</p>}
        </section>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={pending || summary.over} className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50">
          {pending ? 'Saving…' : 'Record payment'}
        </button>
        <Link href={cancelHref} className="rounded border border-zinc-300 px-4 py-2">Cancel</Link>
      </div>
    </form>
  );
}
