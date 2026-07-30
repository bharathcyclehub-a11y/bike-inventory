# Overnight build brief — bike-inventory INV ticket program

You are a Claude Code **cloud** agent running unattended overnight. You start with ZERO context
beyond this repo. Read this file fully, then the referenced spec files, then build. Ibrahim (the
CEO) is asleep and must see real, build-verified progress in the morning.

## Your environment (important)
- You are in an isolated cloud checkout of `bike-inventory`. There is **NO `.env`, NO
  `DATABASE_URL`, NO Vercel access, NO local machine**.
- Therefore you **MUST NOT** run `prisma db push`, `prisma migrate`, any deploy, or anything that
  needs the database or secrets. `npm run build` works because it runs `prisma generate` (reads the
  local `schema.prisma` file, not the DB) then `next build`.
- You work on a **branch only**. Nothing you do goes live. A human applies the DB migration and
  deploys later.

## The one rule (this repo's culture)
**Never write a fact you have not read.** Ground every change in the actual file. Read
`BCH_DEV_RULES.md`, `CLAUDE.md`, `AGENTS.md`, and the relevant `docs/agents/*.md` consultant docs
before editing an area. For any collection operation, answer "what happens at length 0?" and guard
it. Remove unused imports. Match surrounding code style.

## Scope — build EXACTLY these four, nothing else
Full per-feature specs are in this folder. Follow them literally (they cite exact files + line
numbers, verified against the repo):
1. **INV-001 + INV-010** — `spec-INV-001-INV-010.md` — unify every stock mutation through one
   journaling helper in `src/lib/stock-location.ts`; add `location`/`fromLocation`/`toLocation` to
   `InventoryTransaction`; fix the outward writers that bypass `StockLevel`; wire `maxStock` cap +
   `BrandLeadTime` lead time + edit UI. **This is the priority — do it first and most carefully.**
2. **INV-011** — `spec-INV-011.md` — persist cash-discount outcome on `VendorBill`/`VendorPayment`
   + a CD section/report.
3. **INV-009** — `spec-INV-009.md` — configurable recurring-failure tracker
   (`RecurringFailure` + `FailureOccurrence`) + UI. Do NOT seed the 6 failures (Ibrahim enters
   them).
4. **INV-006** — `spec-INV-006.md` — read-only cross-app command view at `/command`. Only wire
   endpoints already reachable and OPEN; every other app renders a "connect later" tile with **zero
   numbers**. Never fabricate a cross-app metric.

## Schema
Apply ONLY the additive changes in `schema-additive-delta.md` to `prisma/schema.prisma`, then
`npx prisma generate`. Do **NOT** apply the HELD (destructive) section — especially the
ExpenseCategory enum→table conversion. Do NOT `db push`.

## Locked decisions (already made by Ibrahim — do not re-litigate)
- **INV-001 deduction:** a sale/dispatch deducts from `BCH_STORE`, falling back
  `BCH_STORE → BCH_WAREHOUSE → BCC_STORE → BCC_WAREHOUSE` (first location with stock). Read the
  configurable value from `AppSetting` key `SALE_DEDUCT_LOCATION` (default `BCH_STORE`). Do NOT run
  the drift-reconcile backfill (needs DB + a snapshot).
- **INV-011 CD:** compute on the full bill grand total (v1); CD keeps reducing payable (keep
  existing `cdDiscountAmount` behaviour); key off the **vendor** (Brand CD stays dormant). Do NOT
  run the CD backfill on existing bills (needs DB).
- **INV-009:** flag "recurring" at **≥ 2 distinct audit cycles**; `auditCycle` is a free-text field
  the user types (e.g. `2026-Q3`).
- **UI:** every new screen follows its archetype in
  `design-system/bch-ops/prompts/master-prompts.md`. Reuse `src/components/ui/*` and the
  `skeleton`/`focus-ring` conventions. Lucide SVG icons only (no emoji in UI chrome; the expense
  emoji tiles are a separate held feature). Do NOT touch `globals.css`, `layout.tsx`, or shared
  components' behaviour.

## Explicitly DO NOT TOUCH (held for a human, in the morning)
- INV-003 / INV-005 expense recorder (needs the destructive enum→table + Iqbal's role).
- INV-014 Petpooja attendance wiring (needs the real export sample).
- INV-002 RBAC (needs Ibrahim's permission-cell decisions; it is the auth-hole class of change).
- Any `db push`, backfill, or deploy.

## Procedure
1. `git fetch origin && git checkout inv-program-build` (this branch holds these docs). If it is
   missing, create it from `main`: `git checkout -b inv-program-build`.
2. `npm install` (node_modules is absent).
3. Apply the additive schema delta → `npx prisma generate`.
4. Build INV-001+INV-010 fully. Run `npm run build`. It MUST exit 0 before you move on.
   Commit: `feat(stock): INV-001 unified journaling ledger + INV-010 capacity wiring`.
5. Build INV-009, then INV-011, then INV-006 — one at a time, `npm run build` green after each,
   commit each with a `feat(...)`/ `INV-00X` message. If a feature can't be made to build, **revert
   that feature's changes** (do not stack broken code), note it in the report, and continue with the
   others. Never leave the branch in a non-building state.
6. `git push origin inv-program-build`.
7. Write `docs/ticket-program/MORNING-REPORT.md`: for each of the 4 — done / partial / reverted,
   the files changed, the `npm run build` exit code, what a human must still do (db push, the exact
   additive columns added, backfills, and per-feature manual verification steps), and anything you
   were unsure about. Be honest; a false "done" is worse than a clear "partial". Commit + push it.

## Definition of done for the overnight run
`npm run build` exits 0 on the final branch state; the branch is pushed; `MORNING-REPORT.md` exists
and truthfully lists what shipped, what's partial, and the exact human follow-up steps. You are NOT
expected to touch the database or deploy — that is explicitly a human step.
