'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { isValidDate, withAsOf } from '@/lib/asof';
import { db } from '@/lib/db';
import { friendlyDbError } from '@/lib/db-errors';
import { CUSTOMER_FIELDS, customerSchema, type CustomerFields } from '@/lib/validation/customer';

export interface CustomerFormState {
  values: CustomerFields;
  errors?: Partial<Record<keyof CustomerFields, string[]>>;
  message?: string;
}

/** Add or edit a customer (section 4.8: validate, check rules, write, refresh). */
export async function saveCustomer(_prev: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const values = Object.fromEntries(CUSTOMER_FIELDS.map((f) => [f, String(formData.get(f) ?? '')])) as CustomerFields;
  const id = Number(formData.get('id')) || null;
  const asOf = String(formData.get('asof') ?? '');

  // 1. Validate.
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) {
    return { values, errors: z.flattenError(parsed.error).fieldErrors, message: 'Please correct the fields marked below.' };
  }
  const c = parsed.data;

  // 2. Business rules: the code must be unique.
  const { data: existing, error: loadError } = await db.from('customers').select('id, code');
  if (loadError) return { values, message: friendlyDbError(loadError) };
  if (existing.some((r) => r.code.toUpperCase() === c.code && r.id !== id)) {
    return { values, errors: { code: [`Customer code ${c.code} is already used by another customer.`] } };
  }

  // 3. Write. Amounts go to the database in rupees.
  const row = {
    code: c.code, name: c.name, city: c.city, state: c.state, contact_person: c.contactPerson,
    email: c.email, phone: c.phone, gstin: c.gstin, credit_days: c.creditDays,
    credit_limit: c.creditLimit / 100, tds_rate_pct: c.tdsRatePct,
  };
  let savedId = id;
  if (id) {
    const { data, error } = await db.from('customers').update(row).eq('id', id).select('id');
    if (error) return { values, message: friendlyDbError(error) };
    if (data.length === 0) return { values, message: 'This customer no longer exists.' };
  } else {
    const { data, error } = await db.from('customers').insert({ ...row, is_active: true }).select('id').single();
    if (error) return { values, message: friendlyDbError(error) };
    savedId = data.id;
  }

  // 4. Refresh: balances, limits and names appear across the app.
  revalidatePath('/', 'layout');
  redirect(withAsOf(`/customers/${savedId}`, isValidDate(asOf) ? asOf : null));
}

export interface ActiveToggleState { message?: string }

/** R9: deactivate or reactivate. Customers with records can't be deleted, only deactivated. */
export async function setCustomerActive(_prev: ActiveToggleState, formData: FormData): Promise<ActiveToggleState> {
  const id = Number(formData.get('id'));
  const active = formData.get('active') === 'true';
  const { data, error } = await db.from('customers').update({ is_active: active }).eq('id', id).select('id');
  if (error) return { message: friendlyDbError(error) };
  if (data.length === 0) return { message: 'This customer no longer exists.' };
  revalidatePath('/', 'layout');
  return {};
}
