import { z } from 'zod';
import { INDIAN_STATES } from '../states';
import { optionalText, percent, requiredText, rupees, wholeNumber } from './fields';

export const CUSTOMER_FIELDS = [
  'code', 'name', 'city', 'state', 'contactPerson', 'email', 'phone', 'gstin', 'creditDays', 'creditLimit', 'tdsRatePct',
] as const;

export type CustomerFields = Record<(typeof CUSTOMER_FIELDS)[number], string>;

/** Part 2, add and edit customer. The unique code is checked against the database separately. */
export const customerSchema = z.object({
  code: requiredText('customer code', 20)
    .regex(/^[A-Za-z0-9_-]+$/, { error: 'Use only letters, digits, - and _ in the code.' })
    .transform((v) => v.toUpperCase()),
  name: requiredText('customer name'),
  city: requiredText('city', 100),
  state: z.enum(INDIAN_STATES, { error: 'Choose the state from the list.' }),
  contactPerson: requiredText('contact person', 100),
  email: z
    .string()
    .trim()
    .min(1, { error: 'Enter the email address.' })
    .pipe(z.email({ error: 'Enter a valid email address, like accounts@company.com.' })),
  phone: optionalText('phone number', 30),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || /^[0-9A-Z]{15}$/.test(v), { error: 'A GSTIN has exactly 15 letters and digits. Leave it blank if there is none.' })
    .transform((v) => (v === '' ? null : v)),
  creditDays: wholeNumber('credit days', 3650),
  creditLimit: rupees('credit limit'),
  tdsRatePct: percent('TDS rate'),
});

export type CustomerInput = z.output<typeof customerSchema>;
