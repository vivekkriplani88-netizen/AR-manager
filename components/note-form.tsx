'use client';

import { useActionState } from 'react';
import { addNote, type NoteFormState } from '@/lib/actions/notes';
import { NOTE_TYPES, type NoteFields } from '@/lib/validation/note';

const input = 'w-full rounded border border-zinc-300 px-2 py-1.5 aria-[invalid=true]:border-red-600';

/**
 * Add a note (R16). On a customer page the invoice is optional and chosen from the customer's
 * invoices; on an invoice page it is fixed.
 */
export function NoteForm({ customerId, invoices, fixedInvoiceId, today, asOf }: {
  customerId: number;
  invoices?: { id: number; label: string }[];
  fixedInvoiceId?: number;
  today: string;
  asOf: string | null;
}) {
  const initial: NoteFields = {
    customerId: String(customerId), invoiceId: fixedInvoiceId ? String(fixedInvoiceId) : '', noteDate: today,
    noteType: 'Call', body: '', followUpDate: '', promiseDate: '', promiseAmount: '',
  };
  const [state, action, pending] = useActionState<NoteFormState, FormData>(addNote, { values: initial });
  const v = state.values;
  const error = (name: keyof NoteFields) => state.errors?.[name]?.[0];
  const label = (name: keyof NoteFields, text: string) => <label htmlFor={`note-${name}`} className="mb-1 block text-sm font-medium">{text}</label>;
  const errorText = (name: keyof NoteFields) => error(name) && <p className="mt-1 text-sm text-red-700">{error(name)}</p>;

  return (
    // A new key after each save starts the form afresh with the values the action returned.
    <form key={state.saved ?? 'new'} action={action} className="space-y-3" noValidate>
      <input type="hidden" name="customerId" value={customerId} />
      {fixedInvoiceId && <input type="hidden" name="invoiceId" value={fixedInvoiceId} />}
      {asOf && <input type="hidden" name="asof" value={asOf} />}
      {state.saved && <p role="status" className="rounded bg-green-50 p-2 text-sm text-green-800">{state.saved}</p>}
      {state.message && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-800">{state.message}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          {label('noteDate', 'Date')}
          <input id="note-noteDate" name="noteDate" type="date" defaultValue={v.noteDate} aria-invalid={Boolean(error('noteDate'))} className={input} />
          {errorText('noteDate')}
        </div>
        <div>
          {label('noteType', 'Type')}
          <select id="note-noteType" name="noteType" defaultValue={v.noteType} className={input}>
            {NOTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {errorText('noteType')}
        </div>
        {invoices && (
          <div>
            {label('invoiceId', 'Invoice (optional)')}
            <select id="note-invoiceId" name="invoiceId" defaultValue={v.invoiceId} aria-invalid={Boolean(error('invoiceId'))} className={input}>
              <option value="">None: about the customer</option>
              {invoices.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>
            {errorText('invoiceId')}
          </div>
        )}
      </div>
      <div>
        {label('body', 'Note')}
        <textarea id="note-body" name="body" rows={3} defaultValue={v.body} aria-invalid={Boolean(error('body'))} className={input} placeholder="Who you spoke to and what was agreed" />
        {errorText('body')}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          {label('followUpDate', 'Follow up on (optional)')}
          <input id="note-followUpDate" name="followUpDate" type="date" defaultValue={v.followUpDate} aria-invalid={Boolean(error('followUpDate'))} className={input} />
          {errorText('followUpDate')}
        </div>
        <div>
          {label('promiseDate', 'Promised to pay by (optional)')}
          <input id="note-promiseDate" name="promiseDate" type="date" defaultValue={v.promiseDate} aria-invalid={Boolean(error('promiseDate'))} className={input} />
          {errorText('promiseDate')}
        </div>
        <div>
          {label('promiseAmount', 'Amount promised (₹)')}
          <input id="note-promiseAmount" name="promiseAmount" inputMode="decimal" defaultValue={v.promiseAmount} aria-invalid={Boolean(error('promiseAmount'))} className={input} />
          {errorText('promiseAmount')}
        </div>
      </div>
      <p className="text-xs text-zinc-500">A promise needs both its date and amount. It is Kept once receipts from the note date to the promise date add up to the amount.</p>
      <button type="submit" disabled={pending} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50">
        {pending ? 'Saving…' : 'Add note'}
      </button>
    </form>
  );
}
