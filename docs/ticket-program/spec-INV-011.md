# INV-011 — build spec

**Feature:** Persist cash-discount (CD) outcome per bill and per payment — snapshot the CD deadline and eligible amount when a vendor bill is created, compute paidOnTime + amount saved/lost at payment time, WARN (never block) when the payment is past the CD window, and drive the bill-detail CD section and the CD-summary report from persisted facts instead of the current read-time heuristic. Keys off Vendor.cd* (v1); Brand.cd* stays dormant.

## Schema delta
- **VendorBill** — ADD cdDeadline DateTime? — snapshot = billDate + vendor.cdTermsDays, set at bill CREATE (stable if vendor terms later change)
- **VendorBill** — ADD cdEligibleAmount Float? — snapshot = round(amount * vendor.cdPercentage/100) at CREATE
- **VendorBill** — ADD cdPercentageSnapshot Float? and cdTermsDaysSnapshot Int? — freeze the vendor terms used, so history is not rewritten when Vendor.cd* changes
- **VendorBill** — ADD cdOutcome CdOutcome @default(NA) — terminal per-bill state
- **VendorBill** — ADD cdAmountSaved Float @default(0) and cdAmountLost Float @default(0) — rolled-up captured vs forgone (lost lives on the bill because an unpaid bill can lapse past deadline with no payment row to attach to)
- **VendorPayment** — ADD paidOnTime Boolean? — paymentDate (date-normalized) <= bill.cdDeadline; null when the settled bill had no CD terms
- **VendorPayment** — ADD cdAmountSaved Float @default(0) — CD captured by THIS settling payment. Keep existing cdDiscountAmount (already applied to bill balance); equal to cdAmountSaved when on-time. Flag to Ibrahim if CD should stop reducing payable
- **(enum) CdOutcome** — NEW enum { NA ELIGIBLE CAPTURED PARTIAL MISSED } — matches schema's enum convention (billedTo-style free String rejected for type safety)

## API changes
- `POST /api/bills` — On create, snapshot CD onto the new VendorBill columns (cdDeadline, cdEligibleAmount, cdPercentageSnapshot, cdTermsDaysSnapshot, cdOutcome=ELIGIBLE) when vendor has CD terms
- `POST /api/payments` — Compute & persist paidOnTime + cdAmountSaved per allocation; set bill.cdOutcome/cdAmountSaved/cdAmountLost on settlement; remove the allocations.length===1 CD restriction; WARN not block when past window
- `GET /api/bills/[id]` — No handler change needed — new scalar columns flow through the existing findUnique; response type gains cd* fields
- `GET /api/bills/[id]/cd-eligibility` — Read snapshot (bill.cdDeadline/cdEligibleAmount) as source of truth instead of recomputing from live vendor terms; keep only the days-remaining countdown as derived
- `GET /api/reports/cd-summary` — NEW route — server-side aggregation of persisted CD facts by vendor (captured vs lost vs eligible); replaces the client-side heuristic in the page
- `POST /api/payments` — validations.ts vendorPaymentSchema already accepts cdDiscountAmount (optional); no schema field add required, but the payments/new UI must now actually send it

## UI pages
- `/bills/[id]` (Detail) — Enhance existing CD banner to show persisted outcome: CD% + cdDeadline (due date), on-time/missed pill, ₹ saved vs ₹ lost. Facts come from bill.cd* — not a live recompute.
- `/payments/new` (Form) — Add CD row under bill allocation: within-window = green 'CD available ₹X (Y%, Nd left)'; past-window = amber WARN, submit stays enabled (verify-style, no hard block). Send cdDiscountAmount in payload.
- `/reports/cd-summary` (Dashboard) — Keep 3-tile summary (Captured/Missed/Eligible) + per-vendor cards, but source from new /api/reports/cd-summary; each tile/vendor links into filtered bills. Per-invoice due date, on-time vs missed count, ₹ captured vs lost.

## Reuse (do not rebuild)
- Existing VendorPayment.cdDiscountAmount column (already applied to bill balance at payments/route.ts L106-108) — cdAmountSaved rides alongside it
- Date math + setHours(0,0,0,0) normalization already in cd-eligibility/route.ts L45-56 — lift verbatim into bill-create and payment-write compute
- cd-summary/page.tsx card + 3-tile shell (L157-268) — keep layout, swap the data source
- bills/[id]/page.tsx CD banner + payment-history CD chip (L124-139, L209-213) — extend, don't rebuild
- payments/new FIFO auto-allocation + bill-select list (L121-161) — CD hint attaches per selected bill
- requireAuth role sets (ADMIN/SUPERVISOR/PURCHASE_MANAGER/ACCOUNTS_MANAGER for reads; ADMIN/ACCOUNTS_MANAGER/SUPERVISOR for writes) — reuse existing
- prisma/migrate-to-4-locations.ts as the pattern for the one-off backfill script

## Files to touch
- `prisma/schema.prisma`
- `src/app/api/bills/route.ts`
- `src/app/api/payments/route.ts`
- `src/app/api/bills/[id]/route.ts`
- `src/app/api/bills/[id]/cd-eligibility/route.ts`
- `src/app/api/reports/cd-summary/route.ts`
- `src/app/(dashboard)/reports/cd-summary/page.tsx`
- `src/app/(dashboard)/bills/[id]/page.tsx`
- `src/app/(dashboard)/payments/new/page.tsx`
- `src/lib/validations.ts`

## Build steps (ordered)
- 1. schema.prisma: add the VendorBill + VendorPayment columns and CdOutcome enum above (all additive/nullable or defaulted — safe). Run `npm run db:push` (repo has NO prisma/migrations dir; it is db push-driven) then `npx prisma generate`.
- 2. api/bills/route.ts POST: after computing dueDate, if vendor.cdTermsDays && vendor.cdPercentage → set cdDeadline = billDate + cdTermsDays, cdEligibleAmount = round(amount*cdPercentage/100), cdPercentageSnapshot, cdTermsDaysSnapshot, cdOutcome = ELIGIBLE; else leave null / NA. Reuse the exact date math already in cd-eligibility route (setHours(0,0,0,0)).
- 3. api/payments/route.ts POST: inside the $transaction, per allocation load the bill; if bill.cdEligibleAmount != null compute paidOnTime = normalize(paymentDate) <= bill.cdDeadline. FIX the length===1 restriction — compute CD per allocation, not only for single-bill payments. On the payment row set paidOnTime + cdAmountSaved (= captured when on-time and this payment fully settles). On the bill: if it becomes fully settled → cdOutcome = paidOnTime ? CAPTURED : MISSED, cdAmountSaved/cdAmountLost accordingly; preserve existing newPaidAmount = paidAmount + amount + allocCd settlement math. NEVER throw on late CD — WARN only.
- 4. NEW api/reports/cd-summary/route.ts (GET, requireAuth ADMIN/SUPERVISOR/PURCHASE_MANAGER/ACCOUNTS_MANAGER): aggregate persisted fields grouped by vendor — per-invoice cdDeadline, on-time vs missed counts, SUM(cdAmountSaved) captured vs SUM(cdAmountLost) lost, plus still-ELIGIBLE-within-window bucket. Derive 'expired-unpaid' lazily (cdDeadline < today && status in PENDING/PARTIALLY_PAID && outcome=ELIGIBLE) since there is no cron.
- 5. reports/cd-summary/page.tsx: replace the client-side vendors+bills fetch loop and the status==='PAID' heuristic (L104-133) with one fetch to the new route; keep the 3-tile shell (Captured/Missed/Eligible) and per-vendor cards.
- 6. bills/[id]/page.tsx: render persisted bill.cdOutcome / cdDeadline / cdAmountSaved / cdAmountLost (bills/[id] GET already returns all scalar columns via include vendor:true). Keep cd-eligibility fetch only for the live 'Nd left' countdown, or point it at the snapshot.
- 7. payments/new/page.tsx: when selected bill(s) are within window show 'CD available ₹X (Y%, Nd left)'; when past cdDeadline show an amber WARN 'CD window passed — ₹X will be recorded as MISSED' but leave submit enabled; include cdDiscountAmount in the POST body (currently omitted entirely).
- 8. Backfill: one-off script (pattern of prisma/migrate-to-4-locations.ts) to snapshot cdDeadline/cdEligibleAmount on existing bills from current Vendor.cd* — flagged as approximate for bills predating a terms change.
- 9. `npm run build` must exit 0; verify bill-detail, cd-summary, and a late-payment WARN on real data at 390px.

## Risks
- ⚠️ GST base is unresolved (see open items): cdEligibleAmount currently = amount*cd% on the GST-inclusive grand total. If Ibrahim wants pre-GST base, VendorBill has NO taxableAmount/gstAmount column — that becomes a schema add + bill-form change, expanding scope.
- ⚠️ Multi-bill CD fix changes settlement: today CD only applies when allocations.length===1. Applying per-allocation CD alters newPaidAmount and can flip a bill to PAID; must clamp cdAmountSaved so paidAmount+saved never exceeds amount and avoid double-counting.
- ⚠️ Snapshot vs live divergence: cd-eligibility route recomputes from live Vendor.cd* while new fields are frozen at bill create. Pick the snapshot as source of truth everywhere or the report and the badge will disagree.
- ⚠️ Backfill of existing bills uses CURRENT vendor terms — wrong for any bill predating a terms change; report will show approximate/NA for legacy rows until reconciled.
- ⚠️ 'Missed while unpaid' has no payment event: cdAmountLost must be set either lazily in the report query or by a sweep; without a cron the persisted bill.cdOutcome will lag reality for bills that lapse untouched — derive the expired-unpaid bucket in the report to compensate.
- ⚠️ Rounding: Math.round on both eligible and saved can drift; settle on round-half-up once and clamp remaining-after-discount >= 0 (as cd-eligibility already does).
- ⚠️ db push on the Supabase prod DB — additive nullable/defaulted columns are safe, but confirm no one is mid-migration and that db push (not a migration file) is the intended path for this repo.

## Open items (ask Ibrahim before/at build — NOT overnight)
- ❓ GST DECISION (blocking the eligible-amount formula): is vendor cash discount computed on the invoice GRAND TOTAL (GST-inclusive) or on the PRE-GST TAXABLE VALUE? The app stores only VendorBill.amount (grand total) — pre-GST requires adding taxableAmount/gstAmount columns and capturing them on the bill form. Also, per GST Sec 15(3), a post-supply CD reduces taxable value only if pre-agreed and linked to the invoice, with proportionate ITC reversal — confirm whether BCH treats CD as a pure cash saving (no tax adjustment) or a taxable-value reduction that must reflect in Zoho.
- ❓ paidOnTime tie-break: is a payment made exactly ON cdDeadline on-time? (proposed: <= deadline = on-time).
- ❓ Does CD continue to reduce the payable balance (current behavior via cdDiscountAmount), or should it be recorded as a saving WITHOUT lowering what we owe? This decides whether cdAmountSaved and cdDiscountAmount stay equal or diverge.
- ❓ Confirm Brand.cd* stays dormant for v1 (ticket says yes) — vendor terms win even when a bill's brand has its own CD%.
- ❓ Backfill: OK to snapshot existing bills from current vendor terms (approximate for old bills), or leave pre-existing bills as NA until manually set?

