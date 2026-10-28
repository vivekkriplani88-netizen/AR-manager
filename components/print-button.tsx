'use client';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white">
      Print
    </button>
  );
}
