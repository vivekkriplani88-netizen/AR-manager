'use client';

import { useActionState } from 'react';
import { setFollowUpDone, type FollowUpState } from '@/lib/actions/notes';

/** Mark a follow-up done, or reopen it. */
export function FollowUpToggle({ id, done }: { id: number; done: boolean }) {
  const [state, action, pending] = useActionState<FollowUpState, FormData>(setFollowUpDone, {});
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="done" value={String(!done)} />
      <button type="submit" disabled={pending} className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs hover:bg-zinc-100 disabled:opacity-50">
        {pending ? 'Saving…' : done ? 'Reopen' : 'Mark done'}
      </button>
      {state.message && <span role="alert" className="ml-2 text-xs text-red-700">{state.message}</span>}
    </form>
  );
}
