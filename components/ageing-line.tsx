import { BUCKETS, type Bucket, type Paise } from '@/lib/ar';
import { formatMoney } from '@/lib/format';

export const BUCKET_LABELS: Record<Bucket, string> = {
  'Not due': 'Not due', '1-15': '1–15', '16-30': '16–30', '31-45': '31–45', '46-90': '46–90', 'Over 90': 'Over 90',
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
