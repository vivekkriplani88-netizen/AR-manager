import { describe, expect, it } from 'vitest';
import { formatBalance, formatDate, formatMoney, formatPercent, toPlainRupees } from '../lib/format';

describe('toPlainRupees', () => {
  it('writes rupees without ₹ or commas, for forms and CSV', () => {
    expect(toPlainRupees(7_080_000)).toBe('70800.00');
    expect(toPlainRupees(5)).toBe('0.05');
    expect(toPlainRupees(1_234_567_890)).toBe('12345678.90');
    expect(toPlainRupees(-10_000_000)).toBe('-100000.00');
  });
});

describe('formatPercent', () => {
  it('shows one decimal, or a dash when there is nothing to compare against', () => {
    expect(formatPercent(111.65)).toBe('111.7%');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(null)).toBe('—');
  });
});

describe('formatMoney (R18)', () => {
  it('uses the rupee sign, Indian digit grouping and two decimals', () => {
    expect(formatMoney(12_345_600)).toBe('₹1,23,456.00');
    expect(formatMoney(41_300_000)).toBe('₹4,13,000.00');
    expect(formatMoney(1_234_567_890)).toBe('₹1,23,45,678.90');
    expect(formatMoney(100_000)).toBe('₹1,000.00');
  });

  it('shows paise exactly', () => {
    expect(formatMoney(0)).toBe('₹0.00');
    expect(formatMoney(5)).toBe('₹0.05');
    expect(formatMoney(99)).toBe('₹0.99');
    expect(formatMoney(100)).toBe('₹1.00');
    expect(formatMoney(6_960_001)).toBe('₹69,600.01');
  });

  it('puts the minus sign before the rupee sign', () => {
    expect(formatMoney(-6_960_000)).toBe('-₹69,600.00');
  });

  it('refuses amounts that are not whole paise', () => {
    expect(() => formatMoney(1.5)).toThrow();
  });
});

describe('formatBalance (R18)', () => {
  it('marks money owed to us Dr and credit balances Cr', () => {
    expect(formatBalance(8_880_000)).toBe('₹88,800.00 Dr');
    expect(formatBalance(-10_000_000)).toBe('₹1,00,000.00 Cr');
  });

  it('shows a zero balance without a suffix', () => {
    expect(formatBalance(0)).toBe('₹0.00');
  });
});

describe('formatDate (R18)', () => {
  it('formats as DD-Mon-YYYY', () => {
    expect(formatDate('2026-08-31')).toBe('31-Aug-2026');
    expect(formatDate('2026-01-05')).toBe('05-Jan-2026');
    expect(formatDate('2028-02-29')).toBe('29-Feb-2028');
  });

  it('names every month', () => {
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => formatDate(`2026-${m}-01`).slice(3, 6));
    expect(months).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  });

  it('never shifts the day, whatever the time zone', () => {
    expect(formatDate('2026-01-01')).toBe('01-Jan-2026');
    expect(formatDate('2026-12-31')).toBe('31-Dec-2026');
  });

  it('refuses text that is not a date', () => {
    expect(() => formatDate('31-08-2026')).toThrow();
    expect(() => formatDate('')).toThrow();
  });
});
