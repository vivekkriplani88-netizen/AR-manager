import type { GstSplit, Paise } from '@/lib/ar';
import { formatMoney } from '@/lib/format';

/** Taxable value, then CGST + SGST or IGST at the rate, then the total. */
export function TaxLines({ taxable, gst, ratePct, total }: { taxable: Paise; gst: GstSplit; ratePct: number; total: Paise }) {
  const intra = gst.igst === 0 && (gst.cgst > 0 || gst.sgst > 0);
  const row = (label: string, amount: Paise, strong = false) => (
    <div className={`flex justify-between gap-6 ${strong ? 'border-t border-zinc-300 pt-1 font-semibold' : ''}`}>
      <dt>{label}</dt><dd className="tabular">{formatMoney(amount)}</dd>
    </div>
  );
  return (
    <dl className="space-y-1 text-sm">
      {row('Taxable value', taxable)}
      {intra ? (
        <>
          {row(`CGST @ ${ratePct / 2}%`, gst.cgst)}
          {row(`SGST @ ${ratePct / 2}%`, gst.sgst)}
        </>
      ) : row(`IGST @ ${ratePct}%`, gst.igst)}
      {row('Total', total, true)}
    </dl>
  );
}
