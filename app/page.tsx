import { Suspense } from 'react';
import { connection } from 'next/server';
import { db } from '@/lib/db';

// Temporary connection check (Part 5 Step 2). Replaced by "Overdue at a glance" later.
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-4 text-2xl font-semibold">AR Manager: connection check</h1>
      <Suspense fallback={<p>Loading customers…</p>}>
        <CustomerList />
      </Suspense>
    </main>
  );
}

async function CustomerList() {
  await connection();
  const { data, error } = await db
    .from('customers')
    .select('id, code, name, city, state')
    .order('code');

  return (
    <>
      {error ? (
        <p className="text-red-600">Could not load customers: {error.message}</p>
      ) : (
        <>
          <p className="mb-4">{data.length} customers loaded from the workspace.</p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Code</th>
                <th className="py-2">Name</th>
                <th className="py-2">City</th>
                <th className="py-2">State</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-2">{c.code}</td>
                  <td className="py-2">{c.name}</td>
                  <td className="py-2">{c.city}</td>
                  <td className="py-2">{c.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
