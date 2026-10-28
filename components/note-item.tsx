import Link from 'next/link';
import { Badge } from '@/components/badges';
import { FollowUpToggle } from '@/components/follow-up-toggle';
import type { Note, PromiseToPay } from '@/lib/ar';
import { formatDate, formatMoney } from '@/lib/format';

const PROMISE_STYLE = {
  Kept: 'bg-green-100 text-green-800',
  Broken: 'bg-red-100 text-red-800',
  Pending: 'bg-amber-100 text-amber-800',
} as const;

/**
 * One note: date, type, invoice, text, its follow-up (due, upcoming or done) and its promise to pay
 * with the R16 status as at the page's date.
 */
export function NoteItem({ note, invoiceNo, invoiceHref, promise, followUpDue }: {
  note: Note;
  invoiceNo?: string;
  invoiceHref?: string;
  promise?: PromiseToPay;
  followUpDue: boolean;
}) {
  return (
    <li className="text-sm">
      <p className="flex flex-wrap items-center gap-2 text-zinc-500">
        <span className="font-medium text-zinc-900">{formatDate(note.noteDate)}</span>
        <Badge className="bg-zinc-100 text-zinc-700">{note.noteType}</Badge>
        {invoiceNo && (invoiceHref ? <Link href={invoiceHref} className="underline">{invoiceNo}</Link> : <span>{invoiceNo}</span>)}
      </p>
      <p className="mt-1 whitespace-pre-line">{note.body}</p>
      {(note.followUpDate || promise) && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {note.followUpDate && (
            <span className="inline-flex items-center gap-2">
              {note.followUpDone ? <Badge className="bg-green-100 text-green-800">Follow-up {formatDate(note.followUpDate)}: done</Badge>
                : followUpDue ? <Badge className="bg-red-100 text-red-800">Follow-up due {formatDate(note.followUpDate)}</Badge>
                : <Badge className="bg-zinc-100 text-zinc-700">Follow-up {formatDate(note.followUpDate)}</Badge>}
              <FollowUpToggle id={note.id} done={note.followUpDone} />
            </span>
          )}
          {promise && (
            <Badge className={PROMISE_STYLE[promise.status]}>
              Promise: {formatMoney(promise.promiseAmount)} by {formatDate(promise.promiseDate)} · {promise.status}
              {promise.status !== 'Kept' && promise.received > 0 && ` (${formatMoney(promise.received)} received)`}
            </Badge>
          )}
        </div>
      )}
    </li>
  );
}
