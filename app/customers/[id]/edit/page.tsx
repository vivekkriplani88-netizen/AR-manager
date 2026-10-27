import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CustomerForm } from '@/components/customer-form';
import { loadArData } from '@/lib/ar/load';
import { asOfParam, withAsOf } from '@/lib/asof';
import { toPlainRupees } from '@/lib/format';

export default function EditCustomerPage(props: PageProps<'/customers/[id]/edit'>) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <EditCustomer {...props} />
    </Suspense>
  );
}

async function EditCustomer({ params, searchParams }: PageProps<'/customers/[id]/edit'>) {
  const id = Number((await params).id);
  const asOf = asOfParam((await searchParams).asof);
  const c = (await loadArData()).customers.find((x) => x.id === id);
  if (!c) notFound();

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Edit {c.code} · {c.name}</h1>
      <CustomerForm
        id={c.id}
        asOf={asOf}
        cancelHref={withAsOf(`/customers/${c.id}`, asOf)}
        initial={{
          code: c.code, name: c.name, city: c.city, state: c.state, contactPerson: c.contactPerson,
          email: c.email, phone: c.phone ?? '', gstin: c.gstin ?? '', creditDays: String(c.creditDays),
          creditLimit: toPlainRupees(c.creditLimit), tdsRatePct: String(c.tdsRatePct),
        }}
      />
    </>
  );
}
