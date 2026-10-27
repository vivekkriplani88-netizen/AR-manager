import { BUCKETS, type Bucket, type Paise } from '@/lib/ar';
import { formatMoney } from '@/lib/format';

export const BUCKET_LABELS: Record<Bucket, string> = {
  'Not due': 'Not due', '1-30': '1–30', '31-60': '31–60', '61-90': '61–90', '91-180': '91–180', 'Over 180': 'Over 180',
};

/** The one-line ageing breakdown: every bucket, overdue ones in red when they hold an amount. */
export function AgeingLine({ buckets }: { buckets: Record<Bucket, Paise> }) {
  return (
    <p className="tabular flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {BUCKETS.map((b) => (
        <span key={b} className={b !== 'Not due' && buckets[b] > 0 ? 'text-red-700' : 'text-zinc-600'}>
          <span className="text-zinc-500">{BUCKET_LABELS[b]}</span> {formatMoney(buckets[b])}
        </span>
      ))}
    </p>
  );
}
