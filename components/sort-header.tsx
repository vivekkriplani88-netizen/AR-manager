import Link from 'next/link';

/**
 * A column header that sorts the list through the URL. Clicking the current column flips the
 * direction; any other column starts ascending. Every other parameter (asof, search, filters) is kept.
 */
export function SortHeader({ label, column, sort, dir, path, params, align = 'left' }: {
  label: string;
  column: string;
  sort: string;
  dir: 'asc' | 'desc';
  path: string;
  params: Record<string, string | null>;
  align?: 'left' | 'right';
}) {
  const active = sort === column;
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) next.set(k, v);
  next.set('sort', column);
  next.set('dir', active && dir === 'asc' ? 'desc' : 'asc');

  return (
    <th className={`p-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <Link href={`${path}?${next.toString()}`} className="whitespace-nowrap hover:underline">
        {label}
        <span className="ml-1 text-zinc-400">{active ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </Link>
    </th>
  );
}
