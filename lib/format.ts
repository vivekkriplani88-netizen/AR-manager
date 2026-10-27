// Display formats (R18): ₹1,23,456.00 with Indian digit grouping, 31-Aug-2026, Dr/Cr balances.
import type { Paise } from './ar/types';
import { isValidDate } from './asof';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const indianGrouping = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹1,23,456.00. Works on whole paise with integer arithmetic, so no rounding can creep in. */
export function formatMoney(amount: Paise): string {
  if (!Number.isInteger(amount)) throw new Error(`Amount must be whole paise, got ${amount}.`);
  const abs = Math.abs(amount);
  const paise = abs % 100;
  const rupees = (abs - paise) / 100;
  return `${amount < 0 ? '-' : ''}₹${indianGrouping.format(rupees)}.${String(paise).padStart(2, '0')}`;
}

/** A balance: positive is owed to us (Dr), negative is a credit balance (Cr). Zero has no suffix. */
export function formatBalance(amount: Paise): string {
  if (amount === 0) return formatMoney(0);
  return `${formatMoney(Math.abs(amount))} ${amount > 0 ? 'Dr' : 'Cr'}`;
}

/** '2026-08-31' → '31-Aug-2026'. Splits the string; never goes through a Date (section 4.11). */
export function formatDate(date: string): string {
  if (!isValidDate(date)) throw new Error(`Not a 'YYYY-MM-DD' date: ${date}`);
  const [y, m, d] = date.split('-');
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
}
