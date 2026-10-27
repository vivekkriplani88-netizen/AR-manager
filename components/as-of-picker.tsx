'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isValidDate, parseAsOf, todayInIndia } from '@/lib/asof';
import { formatDate } from '@/lib/format';

/** The as-at date picker. Writes ?asof= to the URL, keeping the page and its other parameters. */
export function AsOfPicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get('asof');
  const asOf = parseAsOf(raw);
  const today = todayInIndia();

  function go(next: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set('asof', next);
    else params.delete('asof'); // no asof means today, so a bookmark stays current
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor="asof" className="text-zinc-600">As at</label>
      <input
        id="asof"
        type="date"
        value={asOf}
        onChange={(e) => isValidDate(e.target.value) && go(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1"
      />
      {asOf === today ? (
        <span className="text-zinc-500">Today</span>
      ) : (
        <button type="button" onClick={() => go(null)} className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100">
          Back to today ({formatDate(today)})
        </button>
      )}
      {raw !== null && raw !== asOf && (
        <span className="text-red-700">“{raw}” is not a valid date, so today is shown.</span>
      )}
    </div>
  );
}
