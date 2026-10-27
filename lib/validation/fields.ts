// zod building blocks for form fields. Forms send text, so every field starts as a string.
import { z } from 'zod';
import type { Paise } from '../ar/types';
import { isValidDate } from '../asof';

/** A percentage as typed ('18', '12.5'), from 0 to 100 with at most two decimals. Null if not one. */
export function parsePercent(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n <= 100 ? n : null;
}

/** Rupees as typed ('1,25,000.50', '₹500') to whole paise, without floating point. Null if not an amount. */
export function parseRupees(text: string): Paise | null {
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(text.replace(/[₹,\s]/g, ''));
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

export const requiredText = (label: string, max = 200) =>
  z
    .string()
    .trim()
    .min(1, { error: `Enter the ${label}.` })
    .max(max, { error: `Keep the ${label} to ${max} characters or fewer.` });

/** Blank becomes null, which is what the database stores for a missing optional value. */
export const optionalText = (label: string, max = 200) =>
  z
    .string()
    .trim()
    .max(max, { error: `Keep the ${label} to ${max} characters or fewer.` })
    .transform((v) => (v === '' ? null : v));

/** An amount in rupees, returned as whole paise. */
export const rupees = (label: string) =>
  z.string().transform((text, ctx) => {
    if (text.trim() === '') {
      ctx.addIssue({ code: 'custom', message: `Enter the ${label}.` });
      return z.NEVER;
    }
    const amount = parseRupees(text);
    if (amount === null) {
      ctx.addIssue({ code: 'custom', message: `Enter the ${label} in rupees, for example 1,25,000.00.` });
      return z.NEVER;
    }
    return amount;
  });

export const positiveRupees = (label: string) =>
  rupees(label).refine((amount) => amount > 0, { error: `The ${label} must be more than zero.` });

export const date = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `Enter the ${label}.` })
    .refine(isValidDate, { error: `Enter the ${label} as a real date.` });

/** The id of a record chosen from a list. */
export const recordId = (message: string) =>
  z.string().trim().regex(/^\d+$/, { error: message }).transform(Number);

export const wholeNumber = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: `Enter the ${label}.` })
    .regex(/^\d+$/, { error: `Enter the ${label} as a whole number, 0 or more.` })
    .transform(Number)
    .refine((n) => n <= max, { error: `The ${label} cannot be more than ${max}.` });

export const percent = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `Enter the ${label}.` })
    .regex(/^\d{1,3}(\.\d{1,2})?$/, { error: `Enter the ${label} as a percentage from 0 to 100.` })
    .transform(Number)
    .refine((n) => n <= 100, { error: `The ${label} cannot be more than 100%.` });
