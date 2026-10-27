import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { customerSchema, type CustomerFields } from '../lib/validation/customer';
import { parseRupees } from '../lib/validation/fields';

const valid: CustomerFields = {
  code: 'c009', name: 'Example Pvt. Ltd.', city: 'Nashik', state: 'Maharashtra', contactPerson: 'A. Shah',
  email: 'accounts@example.com', phone: '', gstin: '', creditDays: '30', creditLimit: '2,50,000', tdsRatePct: '10',
};
const errorsFor = (overrides: Partial<CustomerFields>) => {
  const r = customerSchema.safeParse({ ...valid, ...overrides });
  return r.success ? {} : z.flattenError(r.error).fieldErrors;
};

describe('parseRupees', () => {
  it('reads amounts as typed, in whole paise', () => {
    expect(parseRupees('250000')).toBe(25_000_000);
    expect(parseRupees('2,50,000.5')).toBe(25_000_050);
    expect(parseRupees('₹ 1,23,456.78')).toBe(12_345_678);
    expect(parseRupees('0.29')).toBe(29); // exact, unlike 0.29 * 100
    expect(parseRupees('0')).toBe(0);
  });

  it('rejects anything that is not a non-negative amount with at most two decimals', () => {
    for (const bad of ['', '-5', '1.234', 'abc', '1e5', '.5', '12.']) expect(parseRupees(bad), bad).toBeNull();
  });
});

describe('customerSchema', () => {
  it('accepts a valid customer and normalises it', () => {
    expect(customerSchema.parse(valid)).toEqual({
      code: 'C009', name: 'Example Pvt. Ltd.', city: 'Nashik', state: 'Maharashtra', contactPerson: 'A. Shah',
      email: 'accounts@example.com', phone: null, gstin: null, creditDays: 30, creditLimit: 25_000_000, tdsRatePct: 10,
    });
  });

  it('requires the required fields', () => {
    const errors = errorsFor({ code: ' ', name: '', city: '', state: '', contactPerson: '', email: '' });
    expect(Object.keys(errors).sort()).toEqual(['city', 'code', 'contactPerson', 'email', 'name', 'state']);
  });

  it('requires a valid email', () => {
    expect(errorsFor({ email: 'accounts@' }).email?.[0]).toMatch(/valid email/);
  });

  it('requires credit days to be a whole number, 0 or more', () => {
    expect(errorsFor({ creditDays: '0' })).toEqual({});
    expect(errorsFor({ creditDays: '-1' }).creditDays).toBeDefined();
    expect(errorsFor({ creditDays: '30.5' }).creditDays).toBeDefined();
  });

  it('requires a credit limit of 0 or more', () => {
    expect(errorsFor({ creditLimit: '0' })).toEqual({});
    expect(errorsFor({ creditLimit: '-100' }).creditLimit).toBeDefined();
    expect(errorsFor({ creditLimit: '' }).creditLimit?.[0]).toBe('Enter the credit limit.');
  });

  it('requires the TDS rate to be from 0 to 100', () => {
    expect(errorsFor({ tdsRatePct: '0' })).toEqual({});
    expect(errorsFor({ tdsRatePct: '100' })).toEqual({});
    expect(errorsFor({ tdsRatePct: '2.5' })).toEqual({});
    expect(errorsFor({ tdsRatePct: '100.5' }).tdsRatePct).toBeDefined();
    expect(errorsFor({ tdsRatePct: '-1' }).tdsRatePct).toBeDefined();
  });

  it('accepts an optional 15-character GSTIN, in capitals', () => {
    expect(customerSchema.parse({ ...valid, gstin: '27aaacb1234c1z5' }).gstin).toBe('27AAACB1234C1Z5');
    expect(errorsFor({ gstin: '27AAACB1234C1Z' }).gstin).toBeDefined();
    expect(errorsFor({ gstin: '27AAACB1234C1Z5X' }).gstin).toBeDefined();
  });

  it('only accepts states from the list, so a misspelling cannot change the GST', () => {
    expect(errorsFor({ state: 'Maharastra' }).state).toBeDefined();
  });

  it('rejects codes with spaces or symbols', () => {
    expect(errorsFor({ code: 'C 009' }).code).toBeDefined();
  });
});
