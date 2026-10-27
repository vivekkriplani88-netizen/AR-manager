import { readFileSync } from 'node:fs';
import { toArData, type DbTables } from '../lib/ar/convert';
import type { ArData } from '../lib/ar/types';

export const raw = readFileSync(new URL('./fixtures/sample.json', import.meta.url), 'utf8');

/** A fresh copy of the sample data, so a test can add records without affecting the others. */
export const loadSample = (): ArData => toArData(JSON.parse(raw) as DbTables);

export const sample = loadSample();

// Ids differ between workspaces, so tests look records up by code or number.
export const customer = (code: string, data = sample) => data.customers.find((c) => c.code === code)!;
export const invoice = (no: string, data = sample) => data.invoices.find((i) => i.invoiceNo === no)!;

/** Every 'YYYY-MM-DD' date from `from` to `to` inclusive. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}
