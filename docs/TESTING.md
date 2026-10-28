# Manual test script

The clicks to make before every release, on the deployed site (or `npm run dev` locally). The
calculations are covered by the automated tests (`npm test`); this script checks that the screens,
forms and exports work end to end and agree with each other.

**Before you start:** reset the workspace so the figures match the sample data
([README → Resetting the workspace](../README.md#resetting-the-workspace)). Several steps add records,
so **reset again when you finish.**

Amounts below are as at the date given. Use the date picker in the header or add `?asof=YYYY-MM-DD`.

---

## 1. Header and as-at date

- [ ] Open `/` with no `?asof=`. The picker shows today in India and the label "Today".
- [ ] Pick 31-Aug-2026. The URL gains `?asof=2026-08-31` and "Back to today" appears.
- [ ] Click Customers, Invoices, Record payment, Statement. Every link keeps `?asof=2026-08-31`.
- [ ] Open `/?asof=2026-02-30`. The page shows today and the header says the date is not valid.

## 2. Spot checks (Part 1 of the brief)

| # | Where | Expected |
|---|---|---|
| 1 | Invoice BWA/26-27/0001 | CGST ₹6,750.00 + SGST ₹6,750.00, total ₹88,500.00, due 05-May-2026 |
| 2 | Invoice BWA/26-27/0002 | IGST ₹63,000.00, total ₹4,13,000.00 |
| 3 | BWA/26-27/0003, as at 31-Aug-2026 | Outstanding ₹69,600.00, Overdue, Part-paid, 90 days late, 61–90 bucket |
| 4 | BWA/26-27/0021 as at 31-Aug / 06-Sep / 15-Sep-2026 | Due ₹88,500.00 / Overdue 2 days, ₹88,500.00 / Paid |
| 5 | Customer C005, as at 31-Aug-2026 | Outstanding ₹1,88,800.00, unapplied ₹1,00,000.00, net ₹88,800.00 Dr |
| 6 | Customer C005, as at 12-Jul-2026 | Net ₹1,00,000.00 **Cr** |
| 7 | BWA/26-27/0007, as at 31-Aug-2026 | Received ₹2,62,500.00, credited ₹29,500.00, outstanding ₹3,000.00 |
| 8 | Statement C002, 01-Apr to 31-Aug-2026 | Opening ₹70,800.00 Dr, 7 lines, closing ₹2,23,000.00 Dr |
| 9 | C002 page, as at 31-Aug-2026 | Promise of 20-Jul-2026 shows **Broken** |
| 10 | Every customer, any date | Balances on the customer list equal the statement closing for the same date |

- [ ] All ten match.

## 3. Overdue at a glance (`/?asof=2026-08-31`)

- [ ] Outstanding ₹21,18,100.00 · Unapplied ₹1,00,000.00 · Net receivable ₹20,18,100.00 Dr
- [ ] Overdue ₹12,86,200.00 (60.7% of outstanding) · DSO 111 days · 11 overdue invoices
- [ ] Ageing totals: Not due ₹8,31,900 · 1–30 ₹6,25,400 · 31–60 ₹2,27,200 · 61–90 ₹69,600 · 91–180 ₹1,87,000 · Over 180 ₹1,77,000
- [ ] Click C003's 91–180 amount: the invoice list shows exactly BWA/25-26/0156 and BWA/26-27/0004.
- [ ] Overdue invoices are red and start with BWA/25-26/0141 (193 days); BWA/26-27/0010 shows Disputed.
- [ ] Needs attention: C003 over limit; C002's broken promise; ₹1,00,000.00 unapplied from RCT/26-27/0011; no follow-ups due.
- [ ] Change the date to 10-Sep-2026: three follow-ups due (01, 05 and 10-Sep).

## 4. Customers

- [ ] `/customers`: search "freight" finds C002 only; filter Inactive shows C008 only.
- [ ] Sort by Balance (descending) as at 31-Aug: C007, C003, C004, C002, C005, C001, C006, C008.
- [ ] Add customer with code `c001`: refused, "Customer code C001 is already used". Try a bad email, credit days −1, TDS 150 and a 14-character GSTIN: each field explains its problem. Nothing is saved.
- [ ] Add a valid customer (state Karnataka). It opens on its own page.
- [ ] Edit it: change the credit limit. Deactivate it: the badge says Inactive and "No new invoices (inactive)" replaces New invoice. Reactivate it.
- [ ] C003 page, as at 31-Aug: red over-limit warning (₹4,46,600.00 Dr against ₹4,00,000.00, 111.7% used).

## 5. Invoices

- [ ] `/invoices?asof=2026-08-31`: totals row ₹39,29,400.00 · ₹17,81,800.00 · ₹29,500.00 · ₹21,18,100.00; BWA/26-27/0014 shows Cancelled and is left out.
- [ ] Filters: Status Cancelled → 0014; Disputed → 0010; August date range → 0020 to 0023.
- [ ] New invoice for C003, taxable ₹10,000: the preview shows the next number (BWA/26-27/0025), IGST, the due date and an amber over-limit warning. Create it anyway: it saves.
- [ ] On that invoice: mark Disputed, then clear it. Cancel it (two clicks). It shows Cancelled; the next new invoice gets 0026, not 0025.
- [ ] BWA/26-27/0017 (part-paid) offers no Cancel button.
- [ ] BWA/26-27/0007: a credit note of taxable ₹2,600 is refused (₹3,068.00 with GST against ₹3,000.00 left); one dated before 12-May-2026 is refused; taxable ₹2,000 saves as BWA/CN/26-27/002 for ₹2,360.00 and outstanding becomes ₹640.00.

## 6. Payments

- [ ] Record payment for C001: bank ₹81,000.00 pre-fills TDS ₹7,500.00 against its open invoice; settlement ₹88,500.00 is allocated in full.
- [ ] Record payment for C003: bank ₹1,59,300.00, TDS ₹14,750.00. The suggestion allocates ₹1,74,050.00 to BWA/25-26/0141 (oldest first). Save.
  - [ ] **Everything agrees:** 0141 is Part-paid with ₹2,950.00 left on its invoice page; C003's balance falls by ₹1,74,050.00 on the customer page and the dashboard; C003's statement shows "Payment received" ₹1,59,300.00 and "TDS deducted by you" ₹14,750.00 on the same date.
- [ ] Try allocating more than an invoice has left, or more than the settlement: refused in plain language, and no receipt is saved.
- [ ] Record a ₹10,000 payment for C006 with no allocations. Its page shows ₹10,000.00 unapplied and an "Allocate unapplied credit" form.
  - [ ] Allocate ₹5,000 to BWA/26-27/0020 with today's date: it becomes Part-paid.
  - [ ] Deleting the receipt now is refused (it has an allocation).
  - [ ] Remove the allocation on the invoice page: the invoice is back to ₹35,400.00.
  - [ ] Delete the receipt: it disappears.

## 7. Notes, follow-ups and promises

- [ ] C002: add a Call note on invoice BWA/26-27/0018 with a follow-up two days ahead and a promise of ₹59,000 by a week ahead. It shows Pending.
- [ ] A promise date without an amount, or a follow-up before the note date, is refused.
- [ ] Set the as-at date to the follow-up date: the follow-up shows Due, and appears on the dashboard. Mark it done: the dashboard count drops. Reopen it.
- [ ] Set the as-at date after the promise date: Broken. Record a C002 payment of ₹59,000 (bank + TDS) dated before the promise date: it shows Kept.

## 8. Statement, printing and exports

- [ ] `/statement`, C002, 01-Apr to 31-Aug-2026: matches spot check 8; footer Not due ₹59,000.00, 31–60 ₹94,400.00, 61–90 ₹69,600.00.
- [ ] From after To: a plain-language message, no statement.
- [ ] Print: one clean A4 page with Brightwater's name and address, the customer, the period, the table and the footer; no navigation or buttons.
- [ ] Export CSV: `Statement_C002_2026-04-01_to_2026-08-31.csv` opens in Excel with ₹-free amounts (`70800.00`) and the address in one cell.
- [ ] Invoice list Export CSV with Status Overdue: 11 rows, total outstanding `1286200.00`.
- [ ] Dashboard ageing Export CSV: the totals row matches the screen.

## 9. Finish

- [ ] Reset the workspace.
- [ ] Re-check spot checks 3, 5 and 8 on the deployed site.
