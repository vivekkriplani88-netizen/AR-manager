// R5 + R6: what a receipt can settle, the oldest-first suggestion, the expected TDS, and the
// allocation rules, checked before anything is saved.
import { formatDate, formatMoney } from '../format';
import { creditableAmount } from './preview';
import type { ArData, Invoice, Paise } from './types';

export interface OpenInvoice { invoice: Invoice; remaining: Paise }
export interface AllocationLine { invoiceId: number; amount: Paise }

/**
 * A customer's invoices that still have something to settle, oldest first by due date then number (R6).
 * Only invoices dated on or before `onDate` can take an allocation dated `onDate`.
 * `remaining` counts every allocation and credit note, whatever its date: that is the limit R6 sets.
 */
export function openInvoices(data: ArData, customerId: number, onDate: string): OpenInvoice[] {
  return data.invoices
    .filter((i) => i.customerId === customerId && !i.isCancelled && i.invoiceDate <= onDate)
    .map((invoice) => ({ invoice, remaining: creditableAmount(data, invoice.id) }))
    .filter((o) => o.remaining > 0)
    .sort((a, b) => a.invoice.dueDate.localeCompare(b.invoice.dueDate) || a.invoice.invoiceNo.localeCompare(b.invoice.invoiceNo));
}

/** R6: allocate `amount` to the open invoices oldest first. Whatever is left over stays unapplied. */
export function suggestAllocations(open: OpenInvoice[], amount: Paise): AllocationLine[] {
  const lines: AllocationLine[] = [];
  let left = amount;
  for (const o of open) {
    if (left <= 0) break;
    const take = Math.min(left, o.remaining);
    lines.push({ invoiceId: o.invoice.id, amount: take });
    left -= take;
  }
  return lines;
}

const ZERO = BigInt(0);
const TWO = BigInt(2);
const BASIS = BigInt(10_000); // a rate in hundredths of a percent: 10% is 1000
/** n ÷ d rounded to the nearest whole number, halves up (non-negative). */
const divideHalfUp = (n: bigint, d: bigint) => (TWO * n + d) / (TWO * d);

/**
 * R5: the TDS a customer is expected to deduct from a bank payment of `bank`: its TDS rate applied
 * to the taxable value (not the total) of the invoices the payment settles, oldest first.
 * An invoice paid in full has TDS of rate × its taxable share; a payment that runs out part-way
 * through an invoice is grossed up for TDS on that part. Nothing is expected on an advance.
 * Only a pre-fill: the receipt saves what the customer actually deducted.
 */
export function expectedTds(open: OpenInvoice[], bank: Paise, ratePct: number): Paise {
  const rate = BigInt(Math.round(ratePct * 100));
  if (rate === ZERO || bank <= 0) return 0;
  let left = BigInt(bank);
  let tds = ZERO;
  for (const { invoice, remaining } of open) {
    if (left === ZERO) break;
    const total = BigInt(invoice.total);
    const taxable = BigInt(invoice.taxableValue);
    const rem = BigInt(remaining);
    // BigInt: remaining × taxable × rate can pass 2^53 for large invoices.
    const fullTds = divideHalfUp(rem * taxable * rate, total * BASIS);
    const bankNeeded = rem - fullTds;
    if (left >= bankNeeded) {
      tds += fullTds;
      left -= bankNeeded;
      continue;
    }
    const denominator = total * BASIS - taxable * rate;
    if (denominator > ZERO) tds += divideHalfUp(left * total * BASIS, denominator) - left;
    break;
  }
  return Number(tds);
}

export interface AllocationSummary { allocated: Paise; unapplied: Paise; over: boolean }

/** How much of `available` the lines allocate, and what stays unapplied credit. */
export function allocationSummary(available: Paise, lines: AllocationLine[]): AllocationSummary {
  const allocated = lines.reduce((sum, l) => sum + l.amount, 0);
  return { allocated, unapplied: available - allocated, over: allocated > available };
}

/** What is left of a receipt to allocate: bank + TDS less every allocation from it, whatever its date. */
export function unallocatedAmount(data: ArData, receiptId: number): Paise {
  const receipt = data.receipts.find((r) => r.id === receiptId);
  if (!receipt) return 0;
  let left = receipt.bankAmount + receipt.tdsAmount;
  for (const a of data.allocations) if (a.receiptId === receiptId) left -= a.amount;
  return left;
}

export interface AllocationContext {
  customerId: number;
  receiptDate: string;
  allocationDate: string;
  available: Paise; // what the receipt can still allocate
}

/** R6: every reason these allocations could not be saved, in plain language. Empty means they can. */
export function checkAllocations(data: ArData, ctx: AllocationContext, lines: AllocationLine[]): string[] {
  const problems: string[] = [];
  if (ctx.allocationDate < ctx.receiptDate) {
    problems.push(`The allocation date cannot be before the receipt date (${formatDate(ctx.receiptDate)}).`);
  }
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  if (total > ctx.available) {
    problems.push(`The allocations add up to ${formatMoney(total)}, but only ${formatMoney(ctx.available)} of the receipt is available.`);
  }
  for (const line of lines) {
    const invoice = data.invoices.find((i) => i.id === line.invoiceId);
    if (!invoice) { problems.push('One of the invoices no longer exists.'); continue; }
    if (line.amount <= 0) problems.push(`The amount for ${invoice.invoiceNo} must be more than zero.`);
    if (invoice.customerId !== ctx.customerId) problems.push(`${invoice.invoiceNo} belongs to another customer.`);
    if (invoice.isCancelled) problems.push(`${invoice.invoiceNo} is cancelled, so nothing can be allocated to it.`);
    if (invoice.invoiceDate > ctx.allocationDate) {
      problems.push(`${invoice.invoiceNo} is dated ${formatDate(invoice.invoiceDate)}, after the allocation date.`);
    }
    const remaining = creditableAmount(data, invoice.id);
    if (!invoice.isCancelled && line.amount > remaining) {
      problems.push(`Only ${formatMoney(remaining)} of ${invoice.invoiceNo} is left to settle.`);
    }
  }
  return problems;
}
