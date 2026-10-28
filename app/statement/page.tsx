import Link from 'next/link';
import { Suspense } from 'react';
import { BUCKET_LABELS } from '@/components/ageing-line';
import { PrintButton } from '@/components/print-button';
import { BUCKETS, statement } from '@/lib/ar';
import { loadArData } from '@/lib/ar/load';
import { asOfParam, withAsOf } from '@/lib/asof';
import { formatBalance, formatDate, formatMoney } from '@/lib/format';
import { requestAsOf } from '@/lib/request-date';
import { SELLER } from '@/lib/seller';
import { parseStatementQuery } from '@/lib/statement-query';

export default function StatementPage({ searchParams }: PageProps<'/statement'>) {
  return (
    <Suspense fallback={<p>Loading statement…</p>}>
      <StatementView searchParams={searchParams} />
    </Suspense>
  );
}

const control = 'rounded border border-zinc-300 bg-white px-2 py-1.5';
const th = 'p-2 text-left font-medium print:px-1 print:py-1';
const thr = 'p-2 text-right font-medium print:px-1 print:py-1';
const td = 'p-2 align-top whitespace-nowrap print:px-1 print:py-0.5';
const tdr = 'p-2 align-top text-right whitespace-nowrap print:px-1 print:py-0.5';

async function StatementView({ searchParams }: Pick<PageProps<'/statement'>, 'searchParams'>) {
  const sp = await searchParams;
  const asOf = await requestAsOf(sp.asof);
  const keep = asOfParam(sp.asof);
  const data = await loadArData();
  const q = parseStatementQuery(sp, data, asOf);
  const customers = [...data.customers].sort((a, b) => a.code.localeCompare(b.code));
  const s = q.customer && !q.error ? statement(data, q.customer.id, q.from, q.to) : null;

  const exportParams = new URLSearchParams({ customer: String(q.customer?.id ?? ''), from: q.from, to: q.to });

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <h1 className="mb-3 text-2xl font-semibold">Statement of account</h1>
        <form className="flex flex-wrap items-end gap-3 text-sm">
          {keep && <input type="hidden" name="asof" value={keep} />}
          <label className="flex flex-col gap-1"><span className="text-zinc-600">Customer</span>
            <select name="customer" defaultValue={q.customer?.id ?? ''} className={control} required>
              <option value="">Choose a customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1"><span className="text-zinc-600">From</span>
            <input type="date" name="from" defaultValue={q.from} className={control} />
          </label>
          <label className="flex flex-col gap-1"><span className="text-zinc-600">To</span>
            <input type="date" name="to" defaultValue={q.to} className={control} />
          </label>
          <button type="submit" className={`${control} hover:bg-zinc-100`}>Show statement</button>
          {s && (
            <>
              <PrintButton />
              <a href={`/statement/export?${exportParams.toString()}`} className={`${control} hover:bg-zinc-100`} download>Export CSV</a>
            </>
          )}
        </form>
        {q.error && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">{q.error}</p>}
        {!q.customer && !q.error && <p className="mt-3 text-sm text-zinc-500">Choose a customer and a period. The period starts on 1 April of the financial year by default.</p>}
      </div>

      {s && (
        <article className="statement rounded border border-zinc-200 bg-white p-6 print:border-0 print:p-0">
          <header className="mb-4 flex flex-wrap justify-between gap-4 border-b border-zinc-300 pb-3">
            <div>
              <p className="text-lg font-semibold">{SELLER.name}</p>
              <p className="text-sm text-zinc-600">{SELLER.address}, {SELLER.state}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">Statement of account</p>
              <p className="text-sm">{formatDate(s.from)} to {formatDate(s.to)}</p>
            </div>
          </header>
          <div className="mb-4 text-sm">
            <p className="font-semibold">{s.customer.name} ({s.customer.code})</p>
            <p>{s.customer.city}, {s.customer.state}{s.customer.gstin && ` · GSTIN ${s.customer.gstin}`}</p>
            <p>Attention: {s.customer.contactPerson}</p>
          </div>

          <table className="tabular w-full border-collapse text-sm print:text-xs">
            <thead className="border-y border-zinc-300"><tr>
              <th className={th}>Date</th><th className={th}>Document</th><th className={th}>Particulars</th>
              <th className={thr}>Debit</th><th className={thr}>Credit</th><th className={thr}>Balance</th>
            </tr></thead>
            <tbody>
              <tr className="border-b border-zinc-100 font-medium">
                <td className={td}>{formatDate(s.from)}</td><td className={td} /><td className="p-2 print:px-1">Opening balance</td>
                <td className={tdr} /><td className={tdr} /><td className={tdr}>{formatBalance(s.opening)}</td>
              </tr>
              {s.lines.map((l, i) => (
                <tr key={`${l.type}-${l.documentNo}-${i}`} className="border-b border-zinc-100 break-inside-avoid">
                  <td className={td}>{formatDate(l.date)}</td>
                  <td className={td}>
                    {l.type === 'Invoice' ? (
                      <Link href={withAsOf(`/invoices/${data.invoices.find((x) => x.invoiceNo === l.documentNo)?.id}`, keep)} className="underline-offset-2 hover:underline print:no-underline">{l.documentNo}</Link>
                    ) : l.documentNo}
                  </td>
                  <td className="p-2 print:px-1 print:py-0.5">{l.description}</td>
                  <td className={tdr}>{l.debit ? formatMoney(l.debit) : ''}</td>
                  <td className={tdr}>{l.credit ? formatMoney(l.credit) : ''}</td>
                  <td className={tdr}>{formatBalance(l.balance)}</td>
                </tr>
              ))}
              {s.lines.length === 0 && (
                <tr><td colSpan={6} className="p-2 text-center text-zinc-500">No transactions in this period.</td></tr>
              )}
            </tbody>
            <tfoot className="border-y-2 border-zinc-400 font-semibold">
              <tr>
                <td className={td}>{formatDate(s.to)}</td><td className={td} /><td className="p-2 print:px-1">Closing balance</td>
                <td className={tdr} /><td className={tdr} /><td className={tdr}>{formatBalance(s.closing)}</td>
              </tr>
            </tfoot>
          </table>

          <section className="mt-6 break-inside-avoid">
            <h2 className="mb-2 text-sm font-semibold">Closing balance by ageing, as at {formatDate(s.to)}</h2>
            <table className="tabular w-full text-sm print:text-xs">
              <thead className="border-b border-zinc-300"><tr>
                {BUCKETS.map((b) => <th key={b} className={thr}>{BUCKET_LABELS[b]}{b === 'Not due' || b === 'Over 90' ? '' : ' days'}</th>)}
                <th className={thr}>Unapplied credit</th><th className={thr}>Closing balance</th>
              </tr></thead>
              <tbody><tr>
                {BUCKETS.map((b) => <td key={b} className={tdr}>{formatMoney(s.buckets[b])}</td>)}
                <td className={tdr}>{s.unapplied ? `− ${formatMoney(s.unapplied)}` : formatMoney(0)}</td>
                <td className={`${tdr} font-semibold`}>{formatBalance(s.closing)}</td>
              </tr></tbody>
            </table>
            {s.unapplied > 0 && (
              <p className="mt-2 text-xs text-zinc-600">
                Unapplied credit of {formatMoney(s.unapplied)} is a payment received but not yet matched to an invoice.
              </p>
            )}
          </section>
          <p className="mt-6 text-xs text-zinc-500">Amounts in INR. Dr: amount due to {SELLER.name}. Cr: amount in your favour.</p>
        </article>
      )}
    </div>
  );
}
