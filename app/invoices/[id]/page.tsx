import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BUCKET_LABELS } from '@/components/ageing-line';
import { Badge, InvoiceStatus } from '@/components/badges';
import { CreditNoteForm } from '@/components/credit-note-form';
import { CancelInvoice, DisputedToggle } from '@/components/invoice-actions';
import { TaxLines } from '@/components/tax-lines';
import { canCancel, creditableAmount, invoicePositions } from '@/lib/ar';
import { loadArData } from '@/lib/ar/load';
import { asOfParam, withAsOf } from '@/lib/asof';
import { requestAsOf, requestToday } from '@/lib/request-date';
import { formatDate, formatMoney } from '@/lib/format';

export default function InvoicePage(props: PageProps<'/invoices/[id]'>) {
  return (
    <Suspense fallback={<p>Loading invoice…</p>}>
      <InvoiceDetail {...props} />
    </Suspense>
  );
}

const card = 'rounded border border-zinc-200 bg-white p-4';
const th = 'p-2 text-left font-medium';
const thr = 'p-2 text-right font-medium';

async function InvoiceDetail({ params, searchParams }: PageProps<'/invoices/[id]'>) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const asOf = await requestAsOf(sp.asof);
  const keep = asOfParam(sp.asof);
  const link = (href: string) => withAsOf(href, keep);

  const data = await loadArData();
  const invoice = data.invoices.find((i) => i.id === id);
  if (!invoice) notFound();
  const customer = data.customers.find((c) => c.id === invoice.customerId)!;

  const exists = invoice.invoiceDate <= asOf; // R10
  const position = invoicePositions(data, asOf).find((p) => p.invoice.id === id);
  const receiptNo = new Map(data.receipts.map((r) => [r.id, r]));
  const allocations = data.allocations
    .filter((a) => a.invoiceId === id && a.allocationDate <= asOf)
    .sort((a, b) => a.allocationDate.localeCompare(b.allocationDate));
  const creditNotes = data.creditNotes
    .filter((c) => c.invoiceId === id && c.creditNoteDate <= asOf)
    .sort((a, b) => a.creditNoteDate.localeCompare(b.creditNoteDate));
  const notes = data.notes
    .filter((n) => n.invoiceId === id && n.noteDate <= asOf)
    .sort((a, b) => b.noteDate.localeCompare(a.noteDate));
  const later = data.allocations.filter((a) => a.invoiceId === id && a.allocationDate > asOf).length
    + data.creditNotes.filter((c) => c.invoiceId === id && c.creditNoteDate > asOf).length;
  const creditable = creditableAmount(data, id);
  const today = await requestToday();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500"><Link href={link('/invoices')} className="hover:underline">Invoices</Link> / {invoice.invoiceNo}</p>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold">
            {invoice.invoiceNo}
            {invoice.isCancelled ? <InvoiceStatus status="Cancelled" isDisputed={invoice.isDisputed} />
              : position ? <InvoiceStatus status={position.status} isPartPaid={position.isPartPaid} isDisputed={invoice.isDisputed} />
              : invoice.isDisputed && <Badge className="bg-amber-100 text-amber-800">Disputed</Badge>}
          </h1>
          <p className="text-sm text-zinc-600">
            <Link href={link(`/customers/${customer.id}`)} className="underline">{customer.code} · {customer.name}</Link> · As at {formatDate(asOf)}
          </p>
        </div>
        {!invoice.isCancelled && (
          <div className="flex flex-wrap items-start gap-2">
            <DisputedToggle id={invoice.id} isDisputed={invoice.isDisputed} />
            {canCancel(data, invoice) && <CancelInvoice id={invoice.id} invoiceNo={invoice.invoiceNo} />}
          </div>
        )}
      </div>

      {invoice.isCancelled && (
        <p className="rounded border border-zinc-300 bg-zinc-100 p-3 text-sm text-zinc-700">
          This invoice is cancelled. It keeps its number and is left out of every total, balance, ageing figure, statement and DSO.
        </p>
      )}
      {!exists && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          This invoice is dated {formatDate(invoice.invoiceDate)}, after the as-at date, so it does not exist yet as at {formatDate(asOf)}.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={card}>
          <h2 className="mb-3 font-semibold">Invoice</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-zinc-500">Invoice date</dt><dd>{formatDate(invoice.invoiceDate)}</dd>
            <dt className="text-zinc-500">Due date</dt><dd>{formatDate(invoice.dueDate)}</dd>
            <dt className="text-zinc-500">Description</dt><dd>{invoice.description}</dd>
          </dl>
        </section>
        <section className={card}>
          <h2 className="mb-3 font-semibold">Tax</h2>
          <TaxLines taxable={invoice.taxableValue} gst={invoice} ratePct={invoice.gstRatePct} total={invoice.total} />
        </section>
        {position && (
          <section className={card}>
            <h2 className="mb-3 font-semibold">Position as at {formatDate(asOf)}</h2>
            <dl className="tabular space-y-1 text-sm">
              <div className="flex justify-between"><dt>Total</dt><dd>{formatMoney(invoice.total)}</dd></div>
              <div className="flex justify-between"><dt>Received</dt><dd>− {formatMoney(position.received)}</dd></div>
              <div className="flex justify-between"><dt>Credited</dt><dd>− {formatMoney(position.credited)}</dd></div>
              <div className={`flex justify-between border-t border-zinc-300 pt-1 font-semibold ${position.status === 'Overdue' ? 'text-red-700' : ''}`}>
                <dt>Outstanding</dt><dd>{formatMoney(position.outstanding)}</dd>
              </div>
            </dl>
            {position.status === 'Overdue' && (
              <p className="mt-2 text-sm text-red-700">{position.daysPastDue} days late · {BUCKET_LABELS[position.bucket!]} days bucket</p>
            )}
            {later > 0 && <p className="mt-2 text-xs text-zinc-500">{later} later allocation or credit note{later === 1 ? '' : 's'} not shown (dated after the as-at date).</p>}
          </section>
        )}
      </div>

      <section className={card}>
        <h2 className="mb-3 font-semibold">Allocations</h2>
        {allocations.length === 0 ? <p className="text-sm text-zinc-500">No payments allocated as at {formatDate(asOf)}.</p> : (
          <table className="tabular w-full text-sm">
            <thead className="border-b border-zinc-200"><tr>
              <th className={th}>Receipt</th><th className={th}>Receipt date</th><th className={th}>Allocated on</th><th className={thr}>Amount</th>
            </tr></thead>
            <tbody>
              {allocations.map((a) => {
                const r = receiptNo.get(a.receiptId);
                return (
                  <tr key={a.id} className="border-b border-zinc-100 last:border-0">
                    <td className="p-2">{r?.receiptNo}</td>
                    <td className="p-2">{r && formatDate(r.receiptDate)}</td>
                    <td className="p-2">{formatDate(a.allocationDate)}</td>
                    <td className="p-2 text-right">{formatMoney(a.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-3 font-semibold">Credit notes</h2>
        {creditNotes.length === 0 ? <p className="mb-4 text-sm text-zinc-500">No credit notes as at {formatDate(asOf)}.</p> : (
          <table className="tabular mb-4 w-full text-sm">
            <thead className="border-b border-zinc-200"><tr>
              <th className={th}>Number</th><th className={th}>Date</th><th className={th}>Reason</th>
              <th className={thr}>Taxable</th><th className={thr}>Total with GST</th>
            </tr></thead>
            <tbody>
              {creditNotes.map((c) => (
                <tr key={c.id} className="border-b border-zinc-100 last:border-0">
                  <td className="p-2 whitespace-nowrap">{c.creditNoteNo}</td>
                  <td className="p-2 whitespace-nowrap">{formatDate(c.creditNoteDate)}</td>
                  <td className="p-2">{c.reason}</td>
                  <td className="p-2 text-right">{formatMoney(c.taxableValue)}</td>
                  <td className="p-2 text-right">{formatMoney(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!invoice.isCancelled && (creditable > 0 ? (
          <details className="rounded border border-zinc-200 p-3">
            <summary className="cursor-pointer text-sm font-medium">Raise a credit note (up to {formatMoney(creditable)} including GST)</summary>
            <div className="mt-3">
              <CreditNoteForm
                // Only what the preview needs: this invoice, its allocations, and the credit notes (for numbering).
                data={{
                  customers: [], receipts: [], notes: [], invoices: [invoice], creditNotes: data.creditNotes,
                  allocations: data.allocations.filter((a) => a.invoiceId === invoice.id),
                }}
                invoice={invoice}
                defaultDate={today < invoice.invoiceDate ? invoice.invoiceDate : today}
              />
            </div>
          </details>
        ) : (
          <p className="text-sm text-zinc-500">Nothing left to credit: this invoice is fully received or credited.</p>
        ))}
      </section>

      <section className={card}>
        <h2 className="mb-3 font-semibold">Notes</h2>
        {notes.length === 0 ? <p className="text-sm text-zinc-500">No notes on this invoice as at {formatDate(asOf)}.</p> : (
          <ul className="space-y-3 text-sm">
            {notes.map((n) => (
              <li key={n.id}>
                <p className="text-zinc-500"><span className="font-medium text-zinc-900">{formatDate(n.noteDate)}</span> · {n.noteType}</p>
                <p>{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
