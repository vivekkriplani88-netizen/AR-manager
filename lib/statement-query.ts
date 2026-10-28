// The statement's customer and period, from ?customer=&from=&to= (shared by the page and the CSV).
import { fyStart, type ArData, type Customer } from './ar';
import { isValidDate } from './asof';
import { formatDate } from './format';

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export interface StatementQuery {
  customer: Customer | null;
  from: string;
  to: string;
  error: string | null; // why no statement can be shown for this period
}

/** Defaults: To is the as-at date and From the start of its financial year (1 April). */
export function parseStatementQuery(params: Params, data: ArData, asOf: string): StatementQuery {
  const id = first(params.customer);
  const customer = /^\d+$/.test(id) ? data.customers.find((c) => c.id === Number(id)) ?? null : null;
  const rawTo = first(params.to);
  const rawFrom = first(params.from);
  const to = isValidDate(rawTo) ? rawTo : asOf;
  const from = isValidDate(rawFrom) ? rawFrom : fyStart(to);

  let error: string | null = null;
  if (id && !customer) error = 'That customer does not exist.';
  else if ((rawFrom && !isValidDate(rawFrom)) || (rawTo && !isValidDate(rawTo))) error = 'Enter the period as real dates.';
  else if (from > to) error = `The period starts (${formatDate(from)}) after it ends (${formatDate(to)}).`;
  return { customer, from, to, error };
}

export function statementFilename(customer: Customer, from: string, to: string): string {
  return `Statement_${customer.code}_${from}_to_${to}.csv`;
}
