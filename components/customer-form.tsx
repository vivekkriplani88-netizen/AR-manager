'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { saveCustomer, type CustomerFormState } from '@/lib/actions/customers';
import { INDIAN_STATES } from '@/lib/states';
import type { CustomerFields } from '@/lib/validation/customer';

const input = 'w-full rounded border border-zinc-300 px-2 py-1.5 aria-[invalid=true]:border-red-600';

export function CustomerForm({ id, initial, asOf, cancelHref }: {
  id: number | null;
  initial: CustomerFields;
  asOf: string | null;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState<CustomerFormState, FormData>(saveCustomer, { values: initial });
  const v = state.values;

  const field = (name: keyof CustomerFields, label: string, control: React.ReactNode, hint?: string) => {
    const error = state.errors?.[name]?.[0];
    return (
      <div>
        <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
        {control}
        {hint && !error && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
        {error && <p id={`${name}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
      </div>
    );
  };
  const text = (name: keyof CustomerFields, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      id={name}
      name={name}
      defaultValue={v[name]}
      aria-invalid={Boolean(state.errors?.[name])}
      aria-describedby={state.errors?.[name] ? `${name}-error` : undefined}
      className={input}
      {...props}
    />
  );

  return (
    <form action={action} className="max-w-3xl space-y-6 rounded border border-zinc-200 bg-white p-6" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      {asOf && <input type="hidden" name="asof" value={asOf} />}

      {state.message && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{state.message}</p>}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Customer</legend>
        {field('code', 'Customer code', text('code', { placeholder: 'C009', autoCapitalize: 'characters' }), 'Unique. Letters, digits, - and _.')}
        {field('name', 'Name', text('name'))}
        {field('city', 'City', text('city'))}
        {field('state', 'State', (
          <select id="state" name="state" defaultValue={v.state} aria-invalid={Boolean(state.errors?.state)} className={input}>
            <option value="">Choose a state…</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ), 'Maharashtra is charged CGST + SGST; every other state IGST.')}
        {field('gstin', 'GSTIN (optional)', text('gstin', { maxLength: 15, autoCapitalize: 'characters' }), '15 characters.')}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Contact</legend>
        {field('contactPerson', 'Contact person', text('contactPerson'))}
        {field('email', 'Email', text('email', { type: 'email' }))}
        {field('phone', 'Phone (optional)', text('phone', { type: 'tel' }))}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-semibold">Credit terms</legend>
        {field('creditDays', 'Credit days', text('creditDays', { inputMode: 'numeric' }), 'Changing this affects new invoices only.')}
        {field('creditLimit', 'Credit limit (₹)', text('creditLimit', { inputMode: 'decimal' }))}
        {field('tdsRatePct', 'TDS rate (%)', text('tdsRatePct', { inputMode: 'decimal' }), 'Pre-fills the expected TDS on payments.')}
      </fieldset>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50">
          {pending ? 'Saving…' : id ? 'Save changes' : 'Add customer'}
        </button>
        <Link href={cancelHref} className="rounded border border-zinc-300 px-4 py-2">Cancel</Link>
      </div>
    </form>
  );
}
