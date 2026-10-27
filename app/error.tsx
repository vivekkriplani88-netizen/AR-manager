'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';

/**
 * Shown when a page fails to load, nearly always because the shared database did not answer.
 * Server error details are hidden in production, so this explains the likely cause plainly.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="max-w-xl rounded border border-red-200 bg-red-50 p-6">
      <h1 className="mb-2 text-lg font-semibold text-red-900">This page could not be loaded</h1>
      <p className="mb-4 text-sm text-red-900">
        The database did not respond as expected. This is usually brief: try again in a moment. If it keeps
        happening, the shared database may be paused.
      </p>
      <button type="button" onClick={() => retry()} className="rounded bg-red-700 px-4 py-2 text-sm text-white">
        Try again
      </button>
    </div>
  );
}
