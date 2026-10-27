import { Suspense } from 'react';
import { customerPositions } from '@/lib/ar';
import { loadArData } from '@/lib/ar/load';
import { readAsOf } from '@/lib/asof';
import { formatBalance, formatDate, formatMoney } from '@/lib/format';

// Temporary: checks the as-at date end to end. Replaced by "Overdue at a glance" in Step 8.
export default function Home({ searchParams }: PageProps<'/'>) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Balances searchParams={searchParams} />
    </Suspense>
  );
}

async function Balances({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  const asOf = await readAsOf(searchParams);
  const rows = customerPositions(await loadArData(), asOf);

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Balances as at {formatDate(asOf)}</h1>
      <table className="tabular w-full bg-white text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">Code</th>
            <th className="p-2">Customer</th>
            <th className="p-2 text-right">Outstanding</th>
            <th className="p-2 text-right">Unapplied</th>
            <th className="p-2 text-right">Net balance</th>
            <th className="p-2 text-right">Overdue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.customer.id} className="border-b">
              <td className="p-2">{r.customer.code}</td>
              <td className="p-2">{r.customer.name}</td>
              <td className="p-2 text-right">{formatMoney(r.outstanding)}</td>
              <td className="p-2 text-right">{formatMoney(r.unapplied)}</td>
              <td className="p-2 text-right">{formatBalance(r.netBalance)}</td>
              <td className={`p-2 text-right ${r.overdue > 0 ? 'text-red-700' : ''}`}>{formatMoney(r.overdue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
