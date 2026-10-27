import { Suspense } from 'react';
import { InvoiceForm } from '@/components/invoice-form';
import { loadArData } from '@/lib/ar/load';
import { asOfParam, withAsOf } from '@/lib/asof';
import { requestToday } from '@/lib/request-date';

export default function NewInvoicePage(props: PageProps<'/invoices/new'>) {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">New invoice</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <NewInvoice {...props} />
      </Suspense>
    </>
  );
}

async function NewInvoice({ searchParams }: Pick<PageProps<'/invoices/new'>, 'searchParams'>) {
  const sp = await searchParams;
  const keep = asOfParam(sp.asof);
  const data = await loadArData();
  const requested = Number(Array.isArray(sp.customer) ? sp.customer[0] : sp.customer);
  const customer = data.customers.find((c) => c.id === requested);

  return (
    <>
      {customer && !customer.isActive && (
        <p role="alert" className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {customer.code} · {customer.name} is inactive, so it cannot be given new invoices. Reactivate it on its customer page first.
        </p>
      )}
      <InvoiceForm
        data={data}
        asOf={keep}
        cancelHref={withAsOf(customer ? `/customers/${customer.id}` : '/invoices', keep)}
        initial={{
          customerId: customer?.isActive ? String(customer.id) : '',
          invoiceDate: await requestToday(),
          description: '',
          taxableValue: '',
          gstRatePct: '18',
        }}
      />
    </>
  );
}
