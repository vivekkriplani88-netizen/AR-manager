// Labels shared by every screen: red for overdue, amber for disputed (section 4.10).

const STATUS_STYLE = {
  Paid: 'bg-green-100 text-green-800',
  Due: 'bg-zinc-100 text-zinc-700',
  Overdue: 'bg-red-100 text-red-800',
  Cancelled: 'bg-zinc-200 text-zinc-500 line-through',
} as const;

export function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

export function InvoiceStatus({ status, isPartPaid = false, isDisputed = false }: {
  status: keyof typeof STATUS_STYLE; isPartPaid?: boolean; isDisputed?: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge className={STATUS_STYLE[status]}>{status}</Badge>
      {isPartPaid && <Badge className="bg-sky-100 text-sky-800">Part-paid</Badge>}
      {isDisputed && <Badge className="bg-amber-100 text-amber-800">Disputed</Badge>}
    </span>
  );
}

export function ActiveStatus({ isActive }: { isActive: boolean }) {
  return isActive
    ? <Badge className="bg-green-100 text-green-800">Active</Badge>
    : <Badge className="bg-zinc-200 text-zinc-600">Inactive</Badge>;
}
