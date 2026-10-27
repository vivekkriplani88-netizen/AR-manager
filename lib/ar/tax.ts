import { SELLER } from '../seller';
import { addDays } from './dates';
import type { Invoice, Paise } from './types';

export interface GstSplit { cgst: Paise; sgst: Paise; igst: Paise }

/** R2: invoice date + the customer's credit days, in calendar days. */
export function dueDate(invoiceDate: string, creditDays: number): string {
  return addDays(invoiceDate, creditDays);
}

/** numerator ÷ denominator, rounded to the nearest whole number, halves up (non-negative inputs). */
function divideHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

export function isIntraState(state: string): boolean {
  return state.trim().toLowerCase() === SELLER.state.toLowerCase();
}

function split(intraState: boolean, taxable: Paise, ratePct: number): GstSplit {
  // The rate in hundredths of a percent keeps every step in whole numbers: 18% is 1800.
  const rate = Math.round(ratePct * 100);
  if (intraState) {
    const half = divideHalfUp(taxable * rate, 20_000);
    return { cgst: half, sgst: half, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: divideHalfUp(taxable * rate, 10_000) };
}

/** R3: CGST + SGST at half the rate each within Maharashtra, otherwise IGST. Each rounded to the paisa, halves up. */
export function gstSplit(state: string, taxable: Paise, ratePct: number): GstSplit {
  return split(isIntraState(state), taxable, ratePct);
}

/** R7: a credit note's GST uses its invoice's rate and its invoice's split. */
export function creditNoteGst(invoice: Invoice, taxable: Paise): GstSplit {
  return split(invoice.igst === 0, taxable, invoice.gstRatePct);
}

/** R3: total = taxable value + GST. */
export function documentTotal(taxable: Paise, gst: GstSplit): Paise {
  return taxable + gst.cgst + gst.sgst + gst.igst;
}
