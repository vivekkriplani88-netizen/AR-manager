'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { isValidDate, withAsOf } from '@/lib/asof';

const AREAS = [
  { href: '/', label: 'Overdue at a glance' },
  { href: '/customers', label: 'Customers' },
  { href: '/invoices', label: 'Invoices' },
];
const ACTIONS = [
  { href: '/receipts/new', label: 'Record payment' },
  { href: '/statement', label: 'Statement' },
];

/** Navigation that carries the current ?asof= to every area (only a valid one). */
export function MainNav() {
  const asOf = useSearchParams().get('asof');
  return <NavLinks asOf={asOf && isValidDate(asOf) ? asOf : null} pathname={usePathname()} />;
}

/** Also the Suspense fallback, rendered before the URL is known. */
export function NavLinks({ asOf, pathname }: { asOf: string | null; pathname: string | null }) {
  const isActive = (href: string) =>
    pathname !== null && (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
  const link = (item: { href: string; label: string }) => (
    <Link
      key={item.href}
      href={withAsOf(item.href, asOf)}
      aria-current={isActive(item.href) ? 'page' : undefined}
      className={`rounded px-2 py-1 ${isActive(item.href) ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'}`}
    >
      {item.label}
    </Link>
  );
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      {AREAS.map(link)}
      <span className="mx-2 h-5 w-px bg-zinc-300" aria-hidden />
      {ACTIONS.map(link)}
    </nav>
  );
}
