import Link from 'next/link';
import { Suspense } from 'react';
import { ActiveStatus } from '@/components/badges';
import { SortHeader } from '@/components/sort-header';
import { customerPositions } from '@/lib/ar';
import { loadArData } from '@/lib/ar/load';
import { asOfParam, parseAsOf, withAsOf } from '@/lib/asof';
import { customerList, parseCustomerListQuery } from '@/lib/customer-list';
import { formatBalance, formatDate, formatMoney, formatPercent } from '@/lib/format';

export default function CustomersPage({ searchParams }: PageProps<'/customers'>) {
  return (
    <Suspense fallback={<p>Loading customers…</p>}>
      <CustomerList searchParams={searchParams} />
    </Suspense>
  );
}

async function CustomerList({ searchParams }: Pick<PageProps<'/customers'>, 'searchParams'>) {
  const sp = await searchParams;
  const asOf = parseAsOf(sp.asof);
  const keepAsOf = asOfParam(sp.asof);
  const query = parseCustomerListQuery(sp);
  const all = customerPositions(await loadArData(), asOf);
  const rows = customerList(all, query);

  const params = { asof: keepAsOf, q: query.q || null, status: query.status === 'all' ? null : query.status };
  const header = (label: string, column: string, align: 'left' | 'right' = 'left') => (
    <SortHeader label={label} column={column} sort={query.sort} dir={query.dir} path="/customers" params={params} align={align} />
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-zinc-600">Balances as at {formatDate(asOf)}</p>
        </div>
        <Link href={withAsOf('/customers/new', keepAsOf)} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">
          Add customer
        </Link>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3 text-sm" role="search">
        {keepAsOf && <input type="hidden" name="asof" value={keepAsOf} />}
        <input type="hidden" name="sort" value={query.sort} />
        <input type="hidden" name="dir" value={query.dir} />
        <label className="flex flex-col gap-1">
          <span className="text-zinc-600">Search code, name, contact or email</span>
          <input name="q" defaultValue={query.q} className="w-72 rounded border border-zinc-300 px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-600">Status</span>
          <select name="status" defaultValue={query.status} className="rounded border border-zinc-300 px-2 py-1.5">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <button type="submit" className="rounded border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-100">Apply</button>
        {(query.q || query.status !== 'all') && (
          <Link href={withAsOf('/customers', keepAsOf)} className="py-1.5 text-zinc-600 underline">Clear</Link>
        )}
      </form>

      <p className="mb-2 text-sm text-zinc-600">Showing {rows.length} of {all.length} customers</p>

      <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="tabular w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              {header('Code', 'code')}
              {header('Name', 'name')}
              {header('City, state', 'location')}
              {header('Contact', 'contact')}
              {header('Credit days', 'creditDays', 'right')}
              {header('Credit limit', 'creditLimit', 'right')}
              {header('Balance', 'balance', 'right')}
              {header('Overdue', 'overdue', 'right')}
              {header('Limit used', 'limitUsed', 'right')}
              {header('Status', 'status')}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const c = p.customer;
              return (
                <tr key={c.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                  <td className="p-2 font-medium">
                    <Link href={withAsOf(`/customers/${c.id}`, keepAsOf)} className="underline-offset-2 hover:underline">{c.code}</Link>
                  </td>
                  <td className="p-2">
                    <Link href={withAsOf(`/customers/${c.id}`, keepAsOf)} className="underline-offset-2 hover:underline">{c.name}</Link>
                  </td>
                  <td className="p-2 whitespace-nowrap">{c.city}, {c.state}</td>
                  <td className="p-2">{c.contactPerson}</td>
                  <td className="p-2 text-right">{c.creditDays}</td>
                  <td className="p-2 text-right whitespace-nowrap">{formatMoney(c.creditLimit)}</td>
                  <td className="p-2 text-right whitespace-nowrap">{formatBalance(p.netBalance)}</td>
                  <td className={`p-2 text-right whitespace-nowrap ${p.overdue > 0 ? 'font-medium text-red-700' : ''}`}>{formatMoney(p.overdue)}</td>
                  <td className={`p-2 text-right ${p.overLimit ? 'font-medium text-red-700' : ''}`}>
                    {formatPercent(p.limitUsedPct)}{p.overLimit && <span className="sr-only"> (over limit)</span>}
                  </td>
                  <td className="p-2"><ActiveStatus isActive={c.isActive} /></td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-zinc-500">No customers match this search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
