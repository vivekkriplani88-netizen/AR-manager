import { Suspense } from 'react';
import { CustomerForm } from '@/components/customer-form';
import { asOfParam, withAsOf } from '@/lib/asof';
import type { CustomerFields } from '@/lib/validation/customer';

const BLANK: CustomerFields = {
  code: '', name: '', city: '', state: '', contactPerson: '', email: '', phone: '', gstin: '',
  creditDays: '30', creditLimit: '', tdsRatePct: '10',
};

export default function NewCustomerPage({ searchParams }: PageProps<'/customers/new'>) {
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Add customer</h1>
      <Suspense fallback={null}>
        <NewCustomer searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewCustomer({ searchParams }: Pick<PageProps<'/customers/new'>, 'searchParams'>) {
  const asOf = asOfParam((await searchParams).asof);
  return <CustomerForm id={null} initial={BLANK} asOf={asOf} cancelHref={withAsOf('/customers', asOf)} />;
}
