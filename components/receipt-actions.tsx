'use client';

import { useActionState, useState } from 'react';
import { deleteReceipt, removeAllocation, type CorrectionState } from '@/lib/actions/receipts';

/** A small correction button that asks once more before acting. */
function ConfirmAction({ action, id, label, confirm, done }: {
  action: (prev: CorrectionState, formData: FormData) => Promise<CorrectionState>;
  id: number;
  label: string;
  confirm: string;
  done: string;
}) {
  const [state, formAction, pending] = useActionState<CorrectionState, FormData>(action, {});
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <button type="button" onClick={() => setAsking(true)} className="text-xs text-red-700 underline">{label}</button>;
  }
  return (
    <form action={formAction} className="inline-flex flex-wrap items-center gap-2 text-xs">
      <input type="hidden" name="id" value={id} />
      <span>{confirm}</span>
      <button type="submit" disabled={pending} className="rounded bg-red-700 px-2 py-0.5 text-white disabled:opacity-50">{pending ? '…' : done}</button>
      <button type="button" onClick={() => setAsking(false)} className="underline">Keep</button>
      {state.message && <span role="alert" className="text-red-700">{state.message}</span>}
    </form>
  );
}

export function RemoveAllocation({ id }: { id: number }) {
  return <ConfirmAction action={removeAllocation} id={id} label="Remove" confirm="The amount goes back to unapplied credit." done="Remove allocation" />;
}

export function DeleteReceipt({ id }: { id: number }) {
  return <ConfirmAction action={deleteReceipt} id={id} label="Delete" confirm="Delete this receipt?" done="Delete receipt" />;
}
