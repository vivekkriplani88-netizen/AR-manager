import 'server-only';
import { connection } from 'next/server';
import { parseAsOf, todayInIndia } from './asof';

// "Today" depends on when the page is requested, so a page may only read the clock once Next.js
// knows it is rendering a request. Reading it earlier fails the prerender (section 4.13).

/** The as-at date for a page: ?asof= when valid, else today in India. */
export async function requestAsOf(value: string | string[] | undefined): Promise<string> {
  await connection();
  return parseAsOf(value);
}

/** Today in India, for a page. */
export async function requestToday(): Promise<string> {
  await connection();
  return todayInIndia();
}
