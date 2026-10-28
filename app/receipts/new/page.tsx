import { Suspense } from 'react';
import { ReceiptForm } from '@/components/receipt-form';
import { loadArData } from '@/lib/ar/load';
import { asOfParam, withAsOf } from '@/lib/asof';
import { requestToday } from '@/lib/request-date';

export default function NewReceiptPage(props: PageProps<'/receipts/new'>) {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Record a payment</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <NewReceipt {...props} />
      </Suspense>
    </>
  );
}

async function NewReceipt({ searchParams }: Pick<PageProps<'/receipts/new'>, 'searchParams'>) {
  const sp = await searchParams;
  const keep = asOfParam(sp.asof);
  const data = await loadArData();
  const requested = Number(Array.isArray(sp.customer) ? sp.customer[0] : sp.customer);
  const customer = data.customers.find((c) => c.id === requested);

  return (
    <ReceiptForm
      data={{ ...data, notes: [] }}
      asOf={keep}
      cancelHref={withAsOf(customer ? `/customers/${customer.id}` : '/', keep)}
      initial={{
        customerId: customer ? String(customer.id) : '',
        receiptDate: await requestToday(),
        bankAmount: '',
        tdsAmount: '',
        mode: 'NEFT',
        reference: '',
      }}
    />
  );
}
