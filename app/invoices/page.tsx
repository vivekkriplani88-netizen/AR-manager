import Link from 'next/link';
import { Suspense } from 'react';
import { InvoiceStatus } from '@/components/badges';
import { SortHeader } from '@/components/sort-header';
import { invoiceRows, invoiceTotals } from '@/lib/ar';
import { loadArData } from '@/lib/ar/load';
import { asOfParam, withAsOf } from '@/lib/asof';
import { requestAsOf } from '@/lib/request-date';
import { formatDate, formatMoney } from '@/lib/format';
import { invoiceList, parseInvoiceListQuery } from '@/lib/invoice-list';

export default function InvoicesPage({ searchParams }: PageProps<'/invoices'>) {
  return (
    <Suspense fallback={<p>Loading invoices…</p>}>
      <InvoiceList searchParams={searchParams} />
    </Suspense>
  );
}

const control = 'rounded border border-zinc-300 bg-white px-2 py-1.5';
const tdr = 'p-2 text-right whitespace-nowrap';

async function InvoiceList({ searchParams }: Pick<PageProps<'/invoices'>, 'searchParams'>) {
  const sp = await searchParams;
  const asOf = await requestAsOf(sp.asof);
  const keep = asOfParam(sp.asof);
  const query = parseInvoiceListQuery(sp);
  const data = await loadArData();
  const all = invoiceRows(data, asOf);
  const rows = invoiceList(all, query);
  const totals = invoiceTotals(rows);
  const filtered = Boolean(query.q || query.customer || query.status !== 'all' || query.disputed !== 'all' || query.from || query.to);

  const params = {
    asof: keep, q: query.q || null, customer: query.customer ? String(query.customer) : null,
    status: query.status === 'all' ? null : query.status, disputed: query.disputed === 'all' ? null : query.disputed,
    from: query.from, to: query.to,
  };
  const header = (label: string, column: string, align: 'left' | 'right' = 'left') => (
    <SortHeader label={label} column={column} sort={query.sort} dir={query.dir} path="/invoices" params={params} align={align} />
  );
  const customers = [...data.customers].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-sm text-zinc-600">As at {formatDate(asOf)}. Invoices dated after this date are not shown.</p>
        </div>
        <Link href={withAsOf('/invoices/new', keep)} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">New invoice</Link>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3 text-sm" role="search">
        {keep && <input type="hidden" name="asof" value={keep} />}
        <input type="hidden" name="sort" value={query.sort} />
        <input type="hidden" name="dir" value={query.dir} />
        <label className="flex flex-col gap-1"><span className="text-zinc-600">Invoice number</span>
          <input name="q" defaultValue={query.q} placeholder="0007" className={`${control} w-36`} />
        </label>
        <label className="flex flex-col gap-1"><span className="text-zinc-600">Customer</span>
          <select name="customer" defaultValue={query.customer ?? ''} className={control}>
            <option value="">All customers</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1"><span className="text-zinc-600">Status</span>
          <select name="status" defaultValue={query.status} className={control}>
            <option value="all">All</option>
            <option value="open">Open (due or overdue)</option>
            <option value="overdue">Overdue</option>
            <option value="due">Due</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="flex flex-col gap-1"><span className="text-zinc-600">Disputed</span>
          <select name="disputed" defaultValue={query.disputed} className={control}>
            <option value="all">All</option>
            <option value="yes">Disputed</option>
            <option value="no">Not disputed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1"><span className="text-zinc-600">Invoice date from</span>
          <input type="date" name="from" defaultValue={query.from ?? ''} className={control} />
        </label>
        <label className="flex flex-col gap-1"><span className="text-zinc-600">to</span>
          <input type="date" name="to" defaultValue={query.to ?? ''} className={control} />
        </label>
        <button type="submit" className={`${control} hover:bg-zinc-100`}>Apply</button>
        {filtered && <Link href={withAsOf('/invoices', keep)} className="py-1.5 text-zinc-600 underline">Clear</Link>}
      </form>

      <p className="mb-2 text-sm text-zinc-600">
        Showing {rows.length} of {all.length} invoices{totals.cancelled > 0 && ` (${totals.cancelled} cancelled, left out of the totals)`}
      </p>

      <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="tabular w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              {header('Number', 'number')}
              {header('Customer', 'customer')}
              {header('Invoice date', 'invoiceDate')}
              {header('Due date', 'dueDate')}
              {header('Total', 'total', 'right')}
              {header('Received', 'received', 'right')}
              {header('Credited', 'credited', 'right')}
              {header('Outstanding', 'outstanding', 'right')}
              {header('Status', 'status')}
              {header('Days late', 'daysLate', 'right')}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cancelled = r.status === 'Cancelled';
              return (
                <tr key={r.invoice.id} className={`border-b border-zinc-100 ${r.status === 'Overdue' ? 'bg-red-50 text-red-900' : cancelled ? 'text-zinc-400' : ''}`}>
                  <td className="p-2 whitespace-nowrap font-medium">
                    <Link href={withAsOf(`/invoices/${r.invoice.id}`, keep)} className="underline-offset-2 hover:underline">{r.invoice.invoiceNo}</Link>
                  </td>
                  <td className="p-2">
                    <Link href={withAsOf(`/customers/${r.customer.id}`, keep)} className="underline-offset-2 hover:underline">{r.customer.code} · {r.customer.name}</Link>
                  </td>
                  <td className="p-2 whitespace-nowrap">{formatDate(r.invoice.invoiceDate)}</td>
                  <td className="p-2 whitespace-nowrap">{formatDate(r.invoice.dueDate)}</td>
                  <td className={tdr}>{formatMoney(r.invoice.total)}</td>
                  <td className={tdr}>{cancelled ? '—' : formatMoney(r.received)}</td>
                  <td className={tdr}>{cancelled ? '—' : formatMoney(r.credited)}</td>
                  <td className={`${tdr} font-medium`}>{cancelled ? '—' : formatMoney(r.outstanding)}</td>
                  <td className="p-2"><InvoiceStatus status={r.status} isPartPaid={r.isPartPaid} isDisputed={r.invoice.isDisputed} /></td>
                  <td className={tdr}>{r.status === 'Overdue' ? r.daysPastDue : ''}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-zinc-500">No invoices match these filters.</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-zinc-300 bg-zinc-50 font-semibold">
              <tr>
                <td className="p-2" colSpan={4}>Total of {totals.count} invoice{totals.count === 1 ? '' : 's'}</td>
                <td className={tdr}>{formatMoney(totals.total)}</td>
                <td className={tdr}>{formatMoney(totals.received)}</td>
                <td className={tdr}>{formatMoney(totals.credited)}</td>
                <td className={tdr}>{formatMoney(totals.outstanding)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
