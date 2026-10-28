import Link from 'next/link';
import { Suspense } from 'react';
import { BUCKET_LABELS } from '@/components/ageing-line';
import { Badge } from '@/components/badges';
import { FollowUpToggle } from '@/components/follow-up-toggle';
import { BUCKETS, dashboard, type Bucket } from '@/lib/ar';
import { loadArData } from '@/lib/ar/load';
import { asOfParam, withAsOf } from '@/lib/asof';
import { formatBalance, formatDate, formatMoney, formatPercent } from '@/lib/format';
import { requestAsOf } from '@/lib/request-date';

export default function Home({ searchParams }: PageProps<'/'>) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

const card = 'rounded border border-zinc-200 bg-white p-4';
const th = 'p-2 text-left font-medium';
const thr = 'p-2 text-right font-medium whitespace-nowrap';
const tdr = 'p-2 text-right whitespace-nowrap';

async function Overview({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  const sp = await searchParams;
  const asOf = await requestAsOf(sp.asof);
  const keep = asOfParam(sp.asof);
  const link = (href: string) => withAsOf(href, keep);

  const data = await loadArData();
  const d = dashboard(data, asOf);
  const s = d.summary;
  const customer = new Map(data.customers.map((c) => [c.id, c]));
  const invoice = new Map(data.invoices.map((i) => [i.id, i]));

  // Ageing amounts link to exactly the invoices behind them.
  const invoicesIn = (customerId: number | null, bucket: Bucket | null) => {
    const q = new URLSearchParams({ status: 'open' });
    if (customerId !== null) q.set('customer', String(customerId));
    if (bucket) q.set('bucket', bucket);
    return link(`/invoices?${q.toString()}`);
  };
  const amount = (value: number, href: string, red = false) =>
    value === 0 ? <span className="text-zinc-300">–</span>
      : <Link href={href} className={`underline-offset-2 hover:underline ${red ? 'text-red-700' : ''}`}>{formatMoney(value)}</Link>;

  const attention = d.overLimit.length + d.brokenPromises.length + d.followUps.length + d.unappliedReceipts.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Overdue at a glance</h1>
        <p className="text-sm text-zinc-600">As at {formatDate(asOf)}</p>
      </div>

      {/* Summary figures */}
      <dl className="tabular grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Outstanding on invoices" value={formatMoney(s.outstanding)} />
        <Kpi label="Unapplied credit" value={formatMoney(s.unapplied)} />
        <Kpi label="Net receivable" value={formatBalance(s.netReceivable)} strong />
        <Kpi label="Overdue" value={formatMoney(s.overdue)} note={`${formatPercent(s.overduePct)} of outstanding`} red={s.overdue > 0} />
        <Kpi label="DSO" value={s.dso === null ? '—' : `${s.dso} days`} note="Last 90 days of sales" />
        <Kpi label="Overdue invoices" value={String(s.overdueCount)} red={s.overdueCount > 0} href={link('/invoices?status=overdue&sort=daysLate&dir=desc')} />
      </dl>

      {/* Needs attention */}
      <section className={card}>
        <h2 className="mb-3 font-semibold">Needs attention {attention > 0 && <span className="text-zinc-500">({attention})</span>}</h2>
        {attention === 0 ? <p className="text-sm text-zinc-500">Nothing needs attention as at {formatDate(asOf)}.</p> : (
          <div className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
            <Attention title="Over credit limit" empty="No customer is over its limit.">
              {d.overLimit.map((p) => (
                <li key={p.customer.id}>
                  <Link href={link(`/customers/${p.customer.id}`)} className="font-medium underline-offset-2 hover:underline">{p.customer.code} · {p.customer.name}</Link>
                  <br /><span className="text-red-700">{formatBalance(p.netBalance)}</span> against {formatMoney(p.customer.creditLimit)} ({formatPercent(p.limitUsedPct)})
                </li>
              ))}
            </Attention>
            <Attention title="Broken promises" empty="No broken promises.">
              {d.brokenPromises.map((p) => {
                const c = customer.get(p.note.customerId)!;
                return (
                  <li key={p.note.id}>
                    <Link href={link(`/customers/${c.id}`)} className="font-medium underline-offset-2 hover:underline">{c.code} · {c.name}</Link>
                    <br />{formatMoney(p.promiseAmount)} promised by {formatDate(p.promiseDate)}; {formatMoney(p.received)} received
                    {p.note.invoiceId !== null && <> · <Link href={link(`/invoices/${p.note.invoiceId}`)} className="underline">{invoice.get(p.note.invoiceId)?.invoiceNo}</Link></>}
                  </li>
                );
              })}
            </Attention>
            <Attention title="Follow-ups due" empty="No follow-ups due.">
              {d.followUps.map((n) => {
                const c = customer.get(n.customerId)!;
                return (
                  <li key={n.id}>
                    <Link href={link(`/customers/${c.id}`)} className="font-medium underline-offset-2 hover:underline">{c.code} · {c.name}</Link>
                    <span className="text-zinc-500"> · due {formatDate(n.followUpDate!)}</span>
                    <br /><span className="line-clamp-2">{n.body}</span>
                    <div className="mt-1"><FollowUpToggle id={n.id} done={n.followUpDone} /></div>
                  </li>
                );
              })}
            </Attention>
            <Attention title="Unapplied credit to allocate" empty="All receipts are allocated.">
              {d.unappliedReceipts.map((r) => {
                const c = customer.get(r.receipt.customerId)!;
                return (
                  <li key={r.receipt.id}>
                    <Link href={link(`/customers/${c.id}`)} className="font-medium underline-offset-2 hover:underline">{c.code} · {c.name}</Link>
                    <br />{formatMoney(r.unapplied)} from {r.receipt.receiptNo} ({formatDate(r.receipt.receiptDate)})
                  </li>
                );
              })}
            </Attention>
          </div>
        )}
      </section>

      {/* Ageing by customer */}
      <section className={card}>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Ageing by customer</h2>
          <a href={withAsOf('/ageing/export', keep)} download className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm hover:bg-zinc-100">Export CSV</a>
        </div>
        <p className="mb-3 text-xs text-zinc-500">Invoice outstanding by days past due. Unapplied credit is shown separately, not netted against any bucket. Click an amount to see its invoices.</p>
        {d.ageing.length === 0 ? <p className="text-sm text-zinc-500">Nothing outstanding.</p> : (
          <div className="overflow-x-auto">
            <table className="tabular w-full text-sm">
              <thead className="border-b border-zinc-200"><tr>
                <th className={th}>Customer</th>
                {BUCKETS.map((b) => <th key={b} className={thr}>{BUCKET_LABELS[b]}</th>)}
                <th className={thr}>Outstanding</th><th className={thr}>Unapplied</th><th className={thr}>Net balance</th>
              </tr></thead>
              <tbody>
                {d.ageing.map((p) => (
                  <tr key={p.customer.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="p-2">
                      <Link href={link(`/customers/${p.customer.id}`)} className="underline-offset-2 hover:underline">{p.customer.code} · {p.customer.name}</Link>
                      {p.overLimit && <> <Badge className="bg-red-100 text-red-800">Over limit</Badge></>}
                    </td>
                    {BUCKETS.map((b) => <td key={b} className={tdr}>{amount(p.buckets[b], invoicesIn(p.customer.id, b), b !== 'Not due')}</td>)}
                    <td className={`${tdr} font-medium`}>{amount(p.outstanding, invoicesIn(p.customer.id, null))}</td>
                    <td className={tdr}>{p.unapplied === 0 ? <span className="text-zinc-300">–</span> : formatMoney(p.unapplied)}</td>
                    <td className={`${tdr} font-medium`}>{formatBalance(p.netBalance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-zinc-300 bg-zinc-50 font-semibold">
                <tr>
                  <td className="p-2">Total</td>
                  {BUCKETS.map((b) => <td key={b} className={tdr}>{amount(d.ageingTotals.buckets[b], invoicesIn(null, b), b !== 'Not due')}</td>)}
                  <td className={tdr}>{amount(d.ageingTotals.outstanding, invoicesIn(null, null))}</td>
                  <td className={tdr}>{formatMoney(d.ageingTotals.unapplied)}</td>
                  <td className={tdr}>{formatBalance(d.ageingTotals.netBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Overdue invoices */}
      <section className={card}>
        <h2 className="mb-3 font-semibold">Overdue invoices <span className="text-zinc-500">({d.overdueInvoices.length})</span></h2>
        {d.overdueInvoices.length === 0 ? <p className="text-sm text-zinc-500">No overdue invoices as at {formatDate(asOf)}.</p> : (
          <div className="overflow-x-auto">
            <table className="tabular w-full text-sm">
              <thead className="border-b border-zinc-200"><tr>
                <th className={th}>Invoice</th><th className={th}>Customer</th><th className={th}>Due date</th>
                <th className={thr}>Days late</th><th className={th}>Bucket</th><th className={thr}>Outstanding</th><th className={th} />
              </tr></thead>
              <tbody>
                {d.overdueInvoices.map((p) => {
                  const c = customer.get(p.invoice.customerId)!;
                  return (
                    <tr key={p.invoice.id} className="border-b border-red-100 bg-red-50 text-red-900">
                      <td className="p-2 whitespace-nowrap font-medium"><Link href={link(`/invoices/${p.invoice.id}`)} className="underline-offset-2 hover:underline">{p.invoice.invoiceNo}</Link></td>
                      <td className="p-2"><Link href={link(`/customers/${c.id}`)} className="underline-offset-2 hover:underline">{c.code} · {c.name}</Link></td>
                      <td className="p-2 whitespace-nowrap">{formatDate(p.invoice.dueDate)}</td>
                      <td className={`${tdr} font-semibold`}>{p.daysPastDue}</td>
                      <td className="p-2 whitespace-nowrap">{BUCKET_LABELS[p.bucket!]}</td>
                      <td className={`${tdr} font-medium`}>{formatMoney(p.outstanding)}</td>
                      <td className="p-2">
                        <span className="inline-flex gap-1">
                          {p.isPartPaid && <Badge className="bg-sky-100 text-sky-800">Part-paid</Badge>}
                          {p.invoice.isDisputed && <Badge className="bg-amber-100 text-amber-800">Disputed</Badge>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, note, strong, red, href }: { label: string; value: string; note?: string; strong?: boolean; red?: boolean; href?: string }) {
  const body = (
    <>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={`mt-1 text-xl ${strong ? 'font-semibold' : ''} ${red ? 'text-red-700' : ''}`}>{value}</dd>
      {note && <dd className="mt-0.5 text-xs text-zinc-500">{note}</dd>}
    </>
  );
  return href
    ? <Link href={href} className={`${card} block hover:border-zinc-400`}>{body}</Link>
    : <div className={card}>{body}</div>;
}

function Attention({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div>
      <h3 className="mb-2 font-medium">{title} <span className="text-zinc-500">({children.length})</span></h3>
      {children.length === 0 ? <p className="text-zinc-500">{empty}</p> : <ul className="space-y-2">{children}</ul>}
    </div>
  );
}
