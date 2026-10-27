import { describe, expect, it } from 'vitest';
import { friendlyDbError } from '../lib/db-errors';

describe('friendlyDbError', () => {
  it('translates known constraints into plain language', () => {
    expect(friendlyDbError({
      code: '23505', message: 'duplicate key value violates unique constraint "customers_workspace_id_code_key"',
    })).toBe('Another customer already uses this code.');
    expect(friendlyDbError({
      code: '23514', message: 'new row violates check constraint "total_equals_taxable_plus_gst"',
    })).toBe('The total does not equal the taxable value plus GST.');
  });

  it('explains other duplicates and permission errors', () => {
    expect(friendlyDbError({ code: '23505', message: 'duplicate key value violates unique constraint "x"' })).toMatch(/already in use/);
    expect(friendlyDbError({ code: '42501', message: 'permission denied for table invoices' })).toMatch(/does not allow/);
  });

  it('passes the database’s own readable messages through', () => {
    const message = 'Invoice BWA/26-27/0007 has only 3000.00 outstanding.';
    expect(friendlyDbError({ code: 'P0001', message })).toBe(message);
  });
});
