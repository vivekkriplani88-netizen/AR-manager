import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ActiveToggle } from '@/components/active-toggle';
import { AgeingLine } from '@/components/ageing-line';
import { ActiveStatus, Badge, InvoiceStatus } from '@/components/badges';
import {
  customerPositions, followUpsDue, invoicePositions, promiseStatuses, receiptPositions, type Invoice, type InvoicePosition,
} from '@/lib/ar';
import { loadArData } from '@/lib/ar/load';
import { asOfParam, parseAsOf, withAsOf } from '@/lib/asof';
import { formatBalance, formatDate, formatMoney, formatPercent } from '@/lib/format';

export default function CustomerPage(props: PageProps<'/customers/[id]'>) {
  return (
    <Suspense fallback={<p>Loading customer…</p>}>
      <Customer {...props} />
    </Suspense>
  );
}

const card = 'rounded border border-zinc-200 bg-white p-4';
const th = 'p-2 font-medium text-left';
const thr = 'p-2 font-medium text-right';
const td = 'p-2 whitespace-nowrap';
const tdr = 'p-2 text-right whitespace-nowrap';

async function Customer({ params, searchParams }: PageProps<'/customers/[id]'>) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const asOf = parseAsOf(sp.asof);
  const keep = asOfParam(sp.asof);
  const link = (href: string) => withAsOf(href, keep);

  const data = await loadArData();
  const c = data.customers.find((x) => x.id === id);
  if (!c) notFound();

  const position = customerPositions(data, asOf).find((p) => p.customer.id === id)!;
  const live = new Map(invoicePositions(data, asOf).filter((p) => p.invoice.customerId === id).map((p) => [p.invoice.id, p]));
  const invoices: { invoice: Invoice; position: InvoicePosition | undefined }[] = data.invoices
    .filter((i) => i.customerId === id && i.invoiceDate <= asOf)
    .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.invoiceNo.localeCompare(b.invoiceNo))
    .map((invoice) => ({ invoice, position: live.get(invoice.id) }));
  const receipts = receiptPositions(data, asOf)
    .filter((r) => r.receipt.customerId === id)
    .sort((a, b) => a.receipt.receiptDate.localeCompare(b.receipt.receiptDate) || a.receipt.receiptNo.localeCompare(b.receipt.receiptNo));
  const promises = new Map(promiseStatuses(data, asOf).map((p) => [p.note.id, p]));
  const followUpDue = new Set(followUpsDue(data, asOf).map((n) => n.id));
  const notes = data.notes
    .filter((n) => n.customerId === id && n.noteDate <= asOf)
    .sort((a, b) => b.noteDate.localeCompare(a.noteDate) || b.id - a.id);
  const invoiceNo = new Map(data.invoices.map((i) => [i.id, i.invoiceNo]));

  return (
    <div className="space-y-6">
      {/* Header and quick actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500"><Link href={link('/customers')} className="hover:underline">Customers</Link> / {c.code}</p>
          <h1 className="flex items-center gap-3 text-2xl font-semibold">{c.name} <ActiveStatus isActive={c.isActive} /></h1>
          <p className="text-sm text-zinc-600">As at {formatDate(asOf)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {c.isActive ? (
            <Link href={link(`/invoices/new?customer=${c.id}`)} className="rounded bg-zinc-900 px-3 py-1.5 text-white">New invoice</Link>
          ) : (
            <span className="rounded border border-dashed border-zinc-300 px-3 py-1.5 text-zinc-500" title="Inactive customers cannot be given new invoices (R9).">
              No new invoices (inactive)
            </span>
          )}
          <Link href={link(`/receipts/new?customer=${c.id}`)} className="rounded border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-100">Record payment</Link>
          <Link href={link(`/statement?customer=${c.id}`)} className="rounded border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-100">Statement</Link>
          <Link href={link(`/customers/${c.id}/edit`)} className="rounded border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-100">Edit</Link>
          <ActiveToggle id={c.id} isActive={c.isActive} />
        </div>
      </div>

      {position.overLimit && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <strong>Over credit limit.</strong> The net balance of {formatBalance(position.netBalance)} is above the
          credit limit of {formatMoney(c.creditLimit)} ({formatPercent(position.limitUsedPct)} used).
        </p>
      )}

      {/* Balance and profile */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className={`${card} lg:col-span-2`}>
          <h2 className="mb-3 font-semibold">Balance</h2>
          <dl className="tabular mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><dt className="text-xs text-zinc-500">Net balance</dt><dd className="text-xl font-semibold">{formatBalance(position.netBalance)}</dd></div>
            <div><dt className="text-xs text-zinc-500">Invoices outstanding</dt><dd className="text-lg">{formatMoney(position.outstanding)}</dd></div>
            <div><dt className="text-xs text-zinc-500">Unapplied credit</dt><dd className="text-lg">{formatMoney(position.unapplied)}</dd></div>
            <div><dt className="text-xs text-zinc-500">Overdue</dt><dd className={`text-lg ${position.overdue > 0 ? 'font-medium text-red-700' : ''}`}>{formatMoney(position.overdue)}</dd></div>
          </dl>
          <h3 className="mb-1 text-xs text-zinc-500">Ageing of invoices outstanding (by days past due)</h3>
          <AgeingLine buckets={position.buckets} />
        </section>

        <section className={card}>
          <h2 className="mb-3 font-semibold">Profile</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-zinc-500">Code</dt><dd>{c.code}</dd>
            <dt className="text-zinc-500">Location</dt><dd>{c.city}, {c.state}</dd>
            <dt className="text-zinc-500">Contact</dt><dd>{c.contactPerson}</dd>
            <dt className="text-zinc-500">Email</dt><dd><a href={`mailto:${c.email}`} className="underline">{c.email}</a></dd>
            <dt className="text-zinc-500">Phone</dt><dd>{c.phone ?? '—'}</dd>
            <dt className="text-zinc-500">GSTIN</dt><dd>{c.gstin ?? '—'}</dd>
            <dt className="text-zinc-500">Credit terms</dt><dd>{c.creditDays} days</dd>
            <dt className="text-zinc-500">Credit limit</dt><dd className="tabular">{formatMoney(c.creditLimit)} ({formatPercent(position.limitUsedPct)} used)</dd>
            <dt className="text-zinc-500">TDS rate</dt><dd>{c.tdsRatePct}%</dd>
          </dl>
        </section>
      </div>

      {/* Invoices */}
      <section className={card}>
        <h2 className="mb-3 font-semibold">Invoices</h2>
        {invoices.length === 0 ? <p className="text-sm text-zinc-500">No invoices dated on or before {formatDate(asOf)}.</p> : (
          <div className="overflow-x-auto">
            <table className="tabular w-full text-sm">
              <thead className="border-b border-zinc-200"><tr>
                <th className={th}>Invoice</th><th className={th}>Date</th><th className={th}>Due</th>
                <th className={thr}>Total</th><th className={thr}>Received</th><th className={thr}>Credited</th>
                <th className={thr}>Outstanding</th><th className={th}>Status</th><th className={thr}>Days late</th>
              </tr></thead>
              <tbody>
                {invoices.map(({ invoice: i, position: p }) => (
                  <tr key={i.id} className={`border-b border-zinc-100 last:border-0 ${p?.status === 'Overdue' ? 'bg-red-50 text-red-900' : ''}`}>
                    <td className={td}><Link href={link(`/invoices/${i.id}`)} className="font-medium underline-offset-2 hover:underline">{i.invoiceNo}</Link></td>
                    <td className={td}>{formatDate(i.invoiceDate)}</td>
                    <td className={td}>{formatDate(i.dueDate)}</td>
                    <td className={tdr}>{formatMoney(i.total)}</td>
                    <td className={tdr}>{p ? formatMoney(p.received) : '—'}</td>
                    <td className={tdr}>{p ? formatMoney(p.credited) : '—'}</td>
                    <td className={`${tdr} font-medium`}>{p ? formatMoney(p.outstanding) : '—'}</td>
                    <td className="p-2">
                      {p ? <InvoiceStatus status={p.status} isPartPaid={p.isPartPaid} isDisputed={i.isDisputed} /> : <InvoiceStatus status="Cancelled" />}
                    </td>
                    <td className={tdr}>{p?.status === 'Overdue' ? p.daysPastDue : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Receipts */}
      <section className={card}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Receipts</h2>
          {position.unapplied > 0 && (
            <p className="rounded bg-sky-50 px-2 py-1 text-sm text-sky-900">
              <strong>{formatMoney(position.unapplied)}</strong> unapplied credit waiting to be allocated
            </p>
          )}
        </div>
        {receipts.length === 0 ? <p className="text-sm text-zinc-500">No receipts dated on or before {formatDate(asOf)}.</p> : (
          <div className="overflow-x-auto">
            <table className="tabular w-full text-sm">
              <thead className="border-b border-zinc-200"><tr>
                <th className={th}>Receipt</th><th className={th}>Date</th><th className={th}>Mode</th><th className={th}>Reference</th>
                <th className={thr}>Bank</th><th className={thr}>TDS</th><th className={thr}>Settlement</th>
                <th className={thr}>Allocated</th><th className={thr}>Unapplied</th>
              </tr></thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.receipt.id} className="border-b border-zinc-100 last:border-0">
                    <td className={`${td} font-medium`}>{r.receipt.receiptNo}</td>
                    <td className={td}>{formatDate(r.receipt.receiptDate)}</td>
                    <td className={td}>{r.receipt.mode}</td>
                    <td className={td}>{r.receipt.reference ?? '—'}</td>
                    <td className={tdr}>{formatMoney(r.receipt.bankAmount)}</td>
                    <td className={tdr}>{formatMoney(r.receipt.tdsAmount)}</td>
                    <td className={tdr}>{formatMoney(r.settlement)}</td>
                    <td className={tdr}>{formatMoney(r.allocated)}</td>
                    <td className={`${tdr} ${r.unapplied > 0 ? 'font-medium text-sky-800' : ''}`}>{formatMoney(r.unapplied)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Notes timeline */}
      <section className={card}>
        <h2 className="mb-3 font-semibold">Notes</h2>
        {notes.length === 0 ? <p className="text-sm text-zinc-500">No notes dated on or before {formatDate(asOf)}.</p> : (
          <ol className="space-y-4 border-l-2 border-zinc-200 pl-4">
            {notes.map((n) => {
              const promise = promises.get(n.id);
              return (
                <li key={n.id} className="text-sm">
                  <p className="flex flex-wrap items-center gap-2 text-zinc-500">
                    <span className="font-medium text-zinc-900">{formatDate(n.noteDate)}</span>
                    <Badge className="bg-zinc-100 text-zinc-700">{n.noteType}</Badge>
                    {n.invoiceId !== null && (
                      <Link href={link(`/invoices/${n.invoiceId}`)} className="underline">{invoiceNo.get(n.invoiceId)}</Link>
                    )}
                  </p>
                  <p className="mt-1">{n.body}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {n.followUpDate && (
                      n.followUpDone ? <Badge className="bg-green-100 text-green-800">Follow-up {formatDate(n.followUpDate)} done</Badge>
                      : followUpDue.has(n.id) ? <Badge className="bg-red-100 text-red-800">Follow-up due {formatDate(n.followUpDate)}</Badge>
                      : <Badge className="bg-zinc-100 text-zinc-700">Follow-up {formatDate(n.followUpDate)}</Badge>
                    )}
                    {promise && (
                      <Badge className={promise.status === 'Kept' ? 'bg-green-100 text-green-800' : promise.status === 'Broken' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>
                        Promise {formatMoney(promise.promiseAmount)} by {formatDate(promise.promiseDate)}: {promise.status}
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
