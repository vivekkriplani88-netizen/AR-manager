'use client';

import { useActionState, useState } from 'react';
import { AllocationTable } from '@/components/allocation-table';
import { allocationSummary, openInvoices, suggestAllocations, type AllocationLine, type ArData, type Receipt } from '@/lib/ar';
import { allocateCredit, type AllocateFormState } from '@/lib/actions/receipts';
import { isValidDate } from '@/lib/asof';
import { formatDate, formatMoney, toPlainRupees } from '@/lib/format';
import { parseRupees } from '@/lib/validation/fields';

const typedLines = (amounts: Record<string, string>): AllocationLine[] =>
  Object.entries(amounts).map(([id, text]) => ({ invoiceId: Number(id), amount: parseRupees(text) ?? 0 }));

/** Allocate unapplied credit from an earlier receipt, with an allocation date (Part 2, R6). */
export function AllocateCreditForm({ data, customerId, credits, today }: {
  data: ArData;
  customerId: number;
  credits: { receipt: Receipt; unallocated: number }[];
  today: string;
}) {
  const initial = { receiptId: String(credits[0]?.receipt.id ?? ''), allocationDate: today };
  const [state, action, pending] = useActionState<AllocateFormState, FormData>(allocateCredit, { values: initial, allocations: {} });
  const [v, setV] = useState(initial);
  const [amounts, setAmounts] = useState<Record<string, string> | null>(null);
  const [lastSaved, setLastSaved] = useState<string | undefined>();
  if (state.saved !== lastSaved) {
    setLastSaved(state.saved);
    setAmounts(null);
  }

  const credit = credits.find((c) => String(c.receipt.id) === v.receiptId) ?? credits[0];
  if (!credit) return null;
  const open = isValidDate(v.allocationDate) ? openInvoices(data, customerId, v.allocationDate) : [];
  const suggested = Object.fromEntries(suggestAllocations(open, credit.unallocated).map((l) => [String(l.invoiceId), toPlainRupees(l.amount)]));
  const shown = amounts ?? suggested;
  const summary = allocationSummary(credit.unallocated, typedLines(shown));
  const dateError = state.errors?.allocationDate?.[0];

  return (
    <form action={action} className="space-y-3" noValidate>
      {state.saved && <p role="status" className="rounded bg-green-50 p-2 text-sm text-green-800">{state.saved}</p>}
      {state.message && (
        <div role="alert" className="rounded bg-red-50 p-2 text-sm text-red-800">
          <p>{state.message}</p>
          {state.problems && <ul className="mt-1 list-disc pl-5">{state.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1"><span className="font-medium">From receipt</span>
          <select name="receiptId" value={String(credit.receipt.id)} onChange={(e) => { setV({ ...v, receiptId: e.target.value }); setAmounts(null); }} className="rounded border border-zinc-300 px-2 py-1.5">
            {credits.map((c) => (
              <option key={c.receipt.id} value={c.receipt.id}>
                {c.receipt.receiptNo} of {formatDate(c.receipt.receiptDate)}: {formatMoney(c.unallocated)} to allocate
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1"><span className="font-medium">Allocation date</span>
          <input type="date" name="allocationDate" min={credit.receipt.receiptDate} value={v.allocationDate} onChange={(e) => { setV({ ...v, allocationDate: e.target.value }); setAmounts(null); }} aria-invalid={Boolean(dateError)} className="rounded border border-zinc-300 px-2 py-1.5 aria-[invalid=true]:border-red-600" />
        </label>
        {amounts !== null && <button type="button" onClick={() => setAmounts(null)} className="py-1.5 underline">Suggest oldest first again</button>}
      </div>
      {dateError && <p className="text-sm text-red-700">{dateError}</p>}
      <AllocationTable open={open} amounts={shown} errors={state.allocationErrors} onChange={(id, value) => setAmounts({ ...shown, [String(id)]: value })} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-3 text-sm">
        <p className="tabular">
          Allocating <strong>{formatMoney(summary.allocated)}</strong>; <span className={summary.over ? 'font-semibold text-red-700' : ''}>{formatMoney(summary.unapplied)}</span> stays unapplied.
        </p>
        <button type="submit" disabled={pending || summary.over || summary.allocated === 0} className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50">
          {pending ? 'Saving…' : 'Allocate'}
        </button>
      </div>
    </form>
  );
}
