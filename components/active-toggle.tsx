'use client';

import { useActionState } from 'react';
import { setCustomerActive, type ActiveToggleState } from '@/lib/actions/customers';

/** R9: deactivate or reactivate a customer. */
export function ActiveToggle({ id, isActive }: { id: number; isActive: boolean }) {
  const [state, action, pending] = useActionState<ActiveToggleState, FormData>(setCustomerActive, {});
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(!isActive)} />
      <button
        type="submit"
        disabled={pending}
        title={isActive ? 'An inactive customer cannot be given new invoices. Its records are kept.' : undefined}
        className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50"
      >
        {pending ? 'Saving…' : isActive ? 'Deactivate' : 'Reactivate'}
      </button>
      {state.message && <span role="alert" className="ml-2 text-sm text-red-700">{state.message}</span>}
    </form>
  );
}
