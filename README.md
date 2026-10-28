# AR Manager

An accounts receivable tool for **Brightwater Advisory Pvt. Ltd.**, built for the Verve Advisory
assignment ([docs/BRIEF.md](docs/BRIEF.md)). It shows who owes the firm money, how late each payment
is and what to do about it, correct to the paisa **as at any date** the user picks.

- **Live site:** https://ar-manager-pink.vercel.app
- **Stack:** Next.js 16 (App Router, TypeScript), Tailwind CSS, Supabase via `@supabase/supabase-js`, zod, Vitest, hosted on Vercel
- **Tests:** 187 automated tests, including every Part 1 spot check and the R14 control check for every day of 2026

---

## What I built

Every screen respects the **as-at date** in the header (`?asof=YYYY-MM-DD`, default today in
Asia/Kolkata). Only records dated on or before it exist (R10), and every link keeps it, so any view
can be bookmarked or shared.

| Area | Where | What it does |
|---|---|---|
| **Overdue at a glance** | `/` | Outstanding, unapplied credit, net receivable, overdue amount and %, DSO and number of overdue invoices; needs attention (over limit, broken promises, follow-ups due, unapplied credit); ageing by customer with a totals row, every amount linking to its invoices; overdue invoices in red, longest first; ageing CSV export |
| **Customer Master** | `/customers`, `/customers/new`, `/customers/[id]`, `/customers/[id]/edit` | Searchable, filterable list sortable by any column, with balance, overdue and % of limit used; add and edit with validation; deactivate and reactivate; customer page with profile, balance and one-line ageing, over-limit warning, invoices, receipts, unapplied credit, notes timeline and quick actions |
| **Invoices** | `/invoices`, `/invoices/new`, `/invoices/[id]` | List filtered by customer, status (open, overdue, due, paid, cancelled), disputed flag, ageing bucket and date range, searchable and sortable, with a totals row and CSV export; create with a live preview of number, due date, GST split, total and the credit-limit warning; invoice page with tax breakdown, position, allocations, credit notes and notes |
| **Actions** | throughout | Record a payment (`/receipts/new`) with TDS pre-filled and an oldest-first allocation suggestion; allocate unapplied credit; raise a credit note; set or clear disputed; cancel an invoice; add a note with follow-up and promise to pay, mark follow-ups done; statement of account (`/statement`) on screen, printed on A4 and as CSV; corrections (remove an allocation, delete an unallocated receipt) |

### How it is built

```
Browser ──► Next.js (server components, server actions, route handlers) ──► Supabase (shared, one workspace)
                    │
                    └── lib/ar/  every financial calculation, as plain functions in whole paise
```

- **One calculation module.** Everything in R2 to R17 lives in [lib/ar/](lib/ar/) as plain
  functions over the loaded data, in whole paise (integers) and `'YYYY-MM-DD'` strings. Screens only
  display what it returns, so the dashboard, customer page, invoice list and statement cannot disagree.

  | File | Rules | Main functions |
  |---|---|---|
  | `dates.ts` | R10 | `daysBetween`, `addDays` (UTC only) |
  | `tax.ts` | R2, R3, R7 | `dueDate`, `gstSplit`, `creditNoteGst` (integer arithmetic, halves up) |
  | `numbering.ts` | R4 | `fyLabel`, `fyStart`, `nextNumber` |
  | `positions.ts` | R11–R14 | `invoicePositions`, `receiptPositions`, `customerPositions`, `balanceByDocuments`, `balanceCheck` |
  | `statement.ts` | R15 | `statement` |
  | `notes.ts` | R16 | `promiseStatuses`, `followUpsDue` |
  | `dso.ts` | R17 | `dso` |
  | `allocation.ts` | R5, R6 | `openInvoices`, `suggestAllocations`, `expectedTds`, `checkAllocations` |
  | `preview.ts` | R2–R4, R7–R9 | `previewInvoice`, `previewCreditNote`, `creditableAmount`, `canCancel` |
  | `invoice-rows.ts`, `dashboard.ts` | | the invoice list and home screen, built from the above |

- **Loading.** [lib/ar/load.ts](lib/ar/load.ts) loads all six tables on every request through the
  single server-only client [lib/db.ts](lib/db.ts), and converts each amount to paise once
  ([lib/ar/convert.ts](lib/ar/convert.ts)). The workspace id never reaches the browser.
- **Saving.** Each form posts to a server action in [lib/actions/](lib/actions/) that validates with
  zod ([lib/validation/](lib/validation/)), checks the business rules with `lib/ar` before touching the
  database, writes, then refreshes the pages. Database errors are translated into plain language
  ([lib/db-errors.ts](lib/db-errors.ts)). Recording a payment saves the receipt and then all its
  allocations in one insert; if that fails, the receipt is deleted again
  ([lib/receipt-save.ts](lib/receipt-save.ts)).
- **Previews use the same functions as saving.** The new-invoice, credit-note and payment forms call
  the `lib/ar` functions in the browser for their live preview, and the server action calls the same
  functions on fresh data to build the row it saves.
- **Formatting** ([lib/format.ts](lib/format.ts)): `₹1,23,456.00` with Indian digit grouping, built
  from paise with integer arithmetic; `31-Aug-2026` without ever creating a JavaScript `Date`; `Dr`/`Cr`.
- **CSV** ([lib/csv.ts](lib/csv.ts), [lib/exports.ts](lib/exports.ts)): UTF-8 BOM, plain amounts
  (`70800.00`), quoting for commas, quotes and line breaks.

---

## Running it

You need **Node.js 20.9 or later** (developed on Node 24 LTS) and access to the shared Supabase project.

```bash
npm install
```

Create `.env.local` in the project root with the three variables (none start with `NEXT_PUBLIC_`,
so they stay on the server; `.gitignore` keeps the file out of git):

```dotenv
SUPABASE_URL=https://jxllwhrinqlzvydzrscs.supabase.co
SUPABASE_ANON_KEY=<the anon key from section 3.1 of the brief>
AR_WORKSPACE_ID=<your workspace id>
```

Then:

```bash
npm run dev      # http://localhost:3000
npm run build    # the production build Vercel runs
npm run lint
```

**On a corporate network** that inspects HTTPS traffic, Node may fail to reach Supabase with
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. Setting the environment variable `NODE_USE_SYSTEM_CA=1` makes
Node trust the Windows certificate store. This is only needed on such a machine, never on Vercel.

### Resetting the workspace

Resetting deletes everything in the workspace and reloads the sample data. Do it before checking
figures against the spot checks, because records added while testing change them.

```bash
curl -X POST "$SUPABASE_URL/rest/v1/rpc/reset_workspace" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "x-workspace: $AR_WORKSPACE_ID" \
  -H "Content-Type: application/json" -d '{}'
```

### Deploying to Vercel

Import the GitHub repository in Vercel (Add New → Project), keep the detected Next.js settings, and
add `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `AR_WORKSPACE_ID` under Environment Variables before the
first deploy. Every push to `main` deploys. After changing a variable, redeploy.

**Checking a deployment:** `/api/health` reports whether each variable is set (with its length, never
its value), which Supabase project the anon key belongs to, and whether the database answers for the
workspace. A healthy deployment shows `"project":"jxllwhrinqlzvydzrscs"` and `"database":{"ok":true,…}`.
A `401 Invalid API key` means `SUPABASE_ANON_KEY` is not the key from section 3.1 of the brief: a
key from your own Supabase project (for example one added by the Supabase–Vercel integration) does
not work with the shared database.

---

## Tests

```bash
npm test
```

187 tests run offline in about a second, against the sample data saved in
[tests/fixtures/sample.json](tests/fixtures/sample.json):

- **All ten Part 1 spot checks** ([tests/spot-checks.test.ts](tests/spot-checks.test.ts)).
- **The R14 control check:** `balanceCheck` is empty for every day from 01-Jan to 31-Oct-2026, and
  stays empty after part-payments, late allocations and a credit note are added.
- **Figures worked out by hand** from the brief's CSVs, not from the code: total outstanding
  ₹21,18,100.00 and DSO 111 as at 31-Aug-2026, C003's full ageing, the C002 statement line by line,
  the dashboard's ageing totals, expected TDS on full and part payments.
- **Rules and edges:** bucket boundaries, GST rounding halves up, due dates across month ends and
  leap years, numbering per financial year (cancelled numbers never reused), statement ordering on
  one day, every statement closing on the R14 balance, promise statuses on and after their dates,
  every R6 allocation rule, the receipt rollback against a database stand-in that fails on purpose.
- **Helpers:** money and date formatting, Dr/Cr, as-at parsing and the IST midnight rollover, CSV
  quoting, form validation and database error messages.

### Refreshing the fixture

Reset the workspace (above), then save the six tables:

```bash
node --env-file=.env.local scripts/snapshot.ts
```

[scripts/snapshot.ts](scripts/snapshot.ts) leaves out `workspace_id` and `created_at`, so the
committed fixture never contains the private workspace id (a test checks this).

### Manual testing

[docs/TESTING.md](docs/TESTING.md) is the click-through checklist for before each release: the spot
checks on screen, every form and correction, and a payment followed through the invoice, customer
page, dashboard and statement to confirm they agree.

---

## Change requests

**Ageing bands (client change request).** The client replaced R12's ageing bands across the whole
application. The bands are now:

| Band | Days past due |
|---|---|
| Not due | 0 or fewer |
| 1–15 | 1 to 15 |
| 16–30 | 16 to 30 |
| 31–45 | 31 to 45 |
| 46–90 | 46 to 90 |
| Over 90 | 91 or more |

They are defined once, in `lib/ar/positions.ts` (`Bucket`, `BUCKETS`, `bucketFor`), and every screen
and export follows them: the dashboard's ageing table and totals, the customer page's one-line
ageing, the invoice list's ageing filter, the statement's ageing footer, and the ageing and statement
CSVs. Only the bands changed: outstanding, overdue, net balances and DSO are unaffected. **Spot check 3
now expects bucket 46–90** for BWA/26-27/0003 (90 days late as at 31-Aug-2026), where the brief says
61–90. As at 31-Aug-2026 the totals are Not due ₹8,31,900 · 1–15 ₹5,07,400 · 16–30 ₹1,18,000 ·
31–45 ₹1,29,800 · 46–90 ₹1,67,000 · Over 90 ₹3,64,000, still ₹21,18,100 in all.

## Assumptions

Where the brief left a choice open, I made these decisions.

**Dates and figures**
- With no `?asof=` the date is today in India, and it is not written into the URL, so a bookmark keeps following today. An invalid `?asof=` falls back to today, with a message in the header.
- **DSO** shows "—" when net sales in the 90-day window are zero **or negative** (the brief mentions only zero; a negative DSO would mean nothing).
- **% of credit limit used** is net balance ÷ credit limit, shown as "—" when the limit is zero.
- **A follow-up is due** only once its note exists: note date ≤ D as well as follow-up date ≤ D (R10).
- **Promise status** counts the settlement value (bank + TDS) of every receipt from the customer between the note date and the promise date, whichever invoice it settles.
- **CSV dates** are written `2026-08-31`, which Excel reads reliably; screens use `31-Aug-2026`.

**Customers**
- **State is chosen from a list** of Indian states and union territories, not typed: the state decides CGST + SGST or IGST, and a misspelling would silently change the tax. The comparison with Maharashtra also ignores case and spaces.
- **Customer codes are stored in capitals**, so `c009` and `C009` are the same code.
- **There is no delete:** the database refuses to delete customers, and R9 says to deactivate.

**Invoices and credit notes**
- **The credit-limit warning** compares the customer's net balance **as at the invoice date**, plus the new invoice's total, with the limit.
- **Credit notes cannot be dated before their invoice.**
- **What can still be credited, allocated or cancelled** counts every allocation and credit note against the invoice, whatever its date. This is the limit the database enforces (R6, R7, R8), so an invoice part-paid after the as-at date still cannot be cancelled.

**Payments**
- **Expected TDS** (only a pre-fill, R5): the customer's rate applied to the taxable value of the invoices the payment settles, oldest first. An invoice paid in full has TDS of rate × its taxable share; a payment that runs out part-way through an invoice is grossed up for TDS on that part; nothing is expected on an advance. For C001's ₹81,000 bank payment against an ₹88,500 invoice this gives ₹7,500, which is what C001 deducts.
- **A payment's allocations are dated the receipt date**, so only invoices dated on or before it are offered. Later allocations go through "Allocate unapplied credit", which takes its own date.
- **"Allocate unapplied credit" offers receipts with credit left today**, whatever the as-at date. A receipt can be unapplied as at a past date but already allocated since.
- **Payments can be recorded for inactive customers.** R9 only stops new invoices.

**Notes**
- **Marking a follow-up done applies to every as-at date.** The database records whether a follow-up is done, not when, so looking back at an earlier date also shows it done.
- **A note cannot refer to an invoice dated after the note.**

**Statements**
- **The default period** runs from 1 April of the financial year to the as-at date.

---

## Known gaps

- **A deleted receipt's number can be used again.** If the most recent receipt is deleted, the next receipt takes its number. The database accepts this (tested), and keeps no record of deleted receipts, so the app cannot tell. This conflicts with R4 ("None is ever reused"). Invoices and credit notes are not affected, since they cannot be deleted.
- **An invoice's description cannot be edited in the app**, although R3 allows it.
- **Without JavaScript**, a refused payment form comes back without the chosen customer, so the allocation table and its messages are not shown. With JavaScript, which is how the app is used, everything is kept.
- **An unknown customer or invoice id** shows the "page not found" screen with HTTP status 200 rather than 404: Next.js streams the page before it knows the record is missing.
- **The printed statement** was checked as a single A4 page by printing it to PDF; check a print preview in the browser for appearance.
- **Number collisions** between two people saving at the same moment are retried once (section 4.8); a third simultaneous save would see a "number already in use" message and need to be saved again.

## What I would do next

1. **Stop receipt numbers being reused:** for example, refuse to delete any receipt except while it is still the latest, or ask for a database change to keep deleted numbers.
2. **Edit an invoice's description** from the invoice page.
3. **A receipt page** listing its allocations, so corrections can start from the receipt as well as the invoice.
4. **End-to-end browser tests** (Playwright) for the forms, alongside the unit tests.
5. **Record when a follow-up was done**, so past as-at dates show it as still open on those dates (needs a schema change).
6. **Statements by email and dunning letters**, once sending email is in scope.
7. If real data arrives: **sign-in and roles**, and moving list filtering into the database once the tables are too large to load per request.

---

## Repository guide

```
app/                 pages, server components and CSV route handlers
components/          forms and shared display pieces
lib/ar/              every financial calculation (pure, tested)
lib/actions/         server actions: validate, check rules, write, refresh
lib/validation/      zod schemas for every form
lib/                 database client, loader, formatting, as-at date, CSV, list filters
scripts/snapshot.ts  saves the sample data as the test fixture
tests/               Vitest tests and the fixture
docs/BRIEF.md        the assignment brief
docs/TESTING.md      the manual test script
ai-logs/             the AI assistant conversations used to build this
```
