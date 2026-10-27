'use client';

import { useActionState, useState } from 'react';
import { cancelInvoice, setInvoiceDisputed, type InvoiceActionState } from '@/lib/actions/invoices';

const button = 'rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50';

/** Set or clear the disputed label. */
export function DisputedToggle({ id, isDisputed }: { id: number; isDisputed: boolean }) {
  const [state, action, pending] = useActionState<InvoiceActionState, FormData>(setInvoiceDisputed, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="disputed" value={String(!isDisputed)} />
      <button type="submit" disabled={pending} className={button}>
        {pending ? 'Saving…' : isDisputed ? 'Clear disputed' : 'Mark as disputed'}
      </button>
      {state.message && <p role="alert" className="mt-1 text-sm text-red-700">{state.message}</p>}
    </form>
  );
}

/** R8: cancel, after a second click to confirm. Offered only when nothing is allocated or credited. */
export function CancelInvoice({ id, invoiceNo }: { id: number; invoiceNo: string }) {
  const [state, action, pending] = useActionState<InvoiceActionState, FormData>(cancelInvoice, {});
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return <button type="button" onClick={() => setConfirming(true)} className={`${button} text-red-700`}>Cancel invoice…</button>;
  }
  return (
    <form action={action} className="rounded border border-red-200 bg-red-50 p-3 text-sm">
      <input type="hidden" name="id" value={id} />
      <p className="mb-2 text-red-900">
        Cancel {invoiceNo}? It stays in the list as Cancelled, its number is never reused, and it leaves every total. This cannot be undone.
      </p>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-red-700 px-3 py-1.5 text-white disabled:opacity-50">
          {pending ? 'Cancelling…' : 'Yes, cancel invoice'}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={button}>Keep it</button>
      </div>
      {state.message && <p role="alert" className="mt-2 text-red-800">{state.message}</p>}
    </form>
  );
}
