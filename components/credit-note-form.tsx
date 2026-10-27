'use client';

import { useActionState, useState } from 'react';
import { TaxLines } from '@/components/tax-lines';
import { previewCreditNote, type ArData, type Invoice } from '@/lib/ar';
import { createCreditNote, type CreditNoteFormState } from '@/lib/actions/invoices';
import { isValidDate } from '@/lib/asof';
import { formatMoney } from '@/lib/format';
import { parseRupees } from '@/lib/validation/fields';
import type { CreditNoteFields } from '@/lib/validation/invoice';

const input = 'w-full rounded border border-zinc-300 px-2 py-1.5 aria-[invalid=true]:border-red-600';

/** R7: raise a credit note, previewing its GST, total and number. */
export function CreditNoteForm({ data, invoice, defaultDate }: { data: ArData; invoice: Invoice; defaultDate: string }) {
  const initial: CreditNoteFields = { creditNoteDate: defaultDate, taxableValue: '', reason: '' };
  const [state, action, pending] = useActionState<CreditNoteFormState, FormData>(createCreditNote, { values: initial });
  const [v, setV] = useState<CreditNoteFields>(initial);
  const [lastSaved, setLastSaved] = useState<string | undefined>();
  if (state.saved !== lastSaved) {
    // After a save, start the next credit note from a clean form.
    setLastSaved(state.saved);
    setV(state.values);
  }
  const set = (name: keyof CreditNoteFields) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [name]: e.target.value });

  const taxable = parseRupees(v.taxableValue);
  const preview = isValidDate(v.creditNoteDate) && taxable !== null && taxable > 0
    ? previewCreditNote(data, invoice, v.creditNoteDate, taxable)
    : null;
  const error = (name: keyof CreditNoteFields) => state.errors?.[name]?.[0];

  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="invoiceId" value={invoice.id} />
      {state.message && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-800">{state.message}</p>}
      {state.saved && <p role="status" className="rounded bg-green-50 p-2 text-sm text-green-800">{state.saved}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="creditNoteDate" className="mb-1 block text-sm font-medium">Credit note date</label>
          <input id="creditNoteDate" name="creditNoteDate" type="date" min={invoice.invoiceDate} value={v.creditNoteDate} onChange={set('creditNoteDate')} aria-invalid={Boolean(error('creditNoteDate'))} className={input} />
          {error('creditNoteDate') && <p className="mt-1 text-sm text-red-700">{error('creditNoteDate')}</p>}
        </div>
        <div>
          <label htmlFor="cnTaxable" className="mb-1 block text-sm font-medium">Taxable value (₹)</label>
          <input id="cnTaxable" name="taxableValue" inputMode="decimal" value={v.taxableValue} onChange={set('taxableValue')} aria-invalid={Boolean(error('taxableValue'))} className={input} />
          {error('taxableValue') && <p className="mt-1 text-sm text-red-700">{error('taxableValue')}</p>}
        </div>
      </div>
      <div>
        <label htmlFor="reason" className="mb-1 block text-sm font-medium">Reason</label>
        <input id="reason" name="reason" value={v.reason} onChange={set('reason')} aria-invalid={Boolean(error('reason'))} className={input} />
        {error('reason') && <p className="mt-1 text-sm text-red-700">{error('reason')}</p>}
      </div>
      {preview && (
        <div className="rounded bg-zinc-50 p-3">
          <p className="mb-2 text-sm">Number <strong>{preview.creditNoteNo}</strong>, at the invoice&apos;s rate and split:</p>
          <TaxLines taxable={taxable!} gst={preview.gst} ratePct={invoice.gstRatePct} total={preview.total} />
          {preview.exceedsCreditable && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              Too large: only {formatMoney(preview.creditable)} of this invoice has not been received or credited.
            </p>
          )}
        </div>
      )}
      <button type="submit" disabled={pending || preview?.exceedsCreditable} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50">
        {pending ? 'Saving…' : 'Raise credit note'}
      </button>
    </form>
  );
}
