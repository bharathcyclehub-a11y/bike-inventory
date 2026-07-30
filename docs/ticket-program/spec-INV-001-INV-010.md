# INV-001 + INV-010 — build spec

**Feature:** Unify every stock mutation through ONE journaling helper in src/lib/stock-location.ts that writes StockLevel + a location-stamped InventoryTransaction + recomputes Product.currentStock atomically; add location/fromLocation/toLocation columns to InventoryTransaction; fix the outward-side writers (outwards, deliveries, deliveries/batch, inwards/verify, stock-reset) that today write Product.currentStock directly and never touch StockLevel (so SUM(StockLevel) drifts above currentStock); add a reconcile/backfill for the existing drift. INV-010: cap reorder qty at Product.maxStock in ai/reorder-suggestions + the reorder-page PO builder, switch reorder lead-time from Vendor.paymentTermDays to BrandLeadTime.leadDays, and expose maxStock/reorderQty/minStock in the existing product edit form. Per-location capacity is explicitly v2.

## Schema delta
- **InventoryTransaction** — ADD location StockLocation? (single-location moves: INWARD/OUTWARD/ADJUSTMENT). Nullable: historical rows have none and TRANSFER uses from/to instead.
- **InventoryTransaction** — ADD fromLocation StockLocation? and toLocation StockLocation? (TRANSFER rows only). Mirrors the existing TransferOrderItem.fromLocation/toLocation StockLocation? pair (schema.prisma:1135-1136).
- **InventoryTransaction** — ADD @@index([location]) and @@index([type, location, createdAt]) to serve per-location movement/outward reports (reports/movement, ai/reorder-suggestions groupBy). Existing indexes at schema.prisma:424-429.
- **Product** — NO column change — maxStock Int @default(0) already exists (schema.prisma:272); INV-010 only reads it. reorderLevel/reorderQty/minStock also already present.
- **StockLevel** — NO column change — reservedQuantity already exists (schema.prisma:323); v2 may move reservation off Product.reservedStock onto it. Not in this ticket.
- **AppSetting (key/value store, no schema change)** — NEW keys via existing PUT /api/settings: SALE_DEDUCT_LOCATION (default "BCH_STORE") and SALE_DEDUCT_LOCATION_BCC (default "BCC_STORE") — the configurable sale/dispatch deduction location. Flag for Ibrahim below.

## API changes
- `POST /api/inventory/outwards` — PRIMARY BUG FIX. outwardSchema gains optional location (default resolveDeductionLocation(SALE_DEDUCT_LOCATION)); replace direct currentStock write + ledger create (route.ts:70-94) with journalMovement(OUTWARD,-qty,location).
- `PATCH /api/deliveries/[id]` — Replace direct currentStock writes + ledger creates in both deduction branches (route.ts:171-260) and the reserve/cancel-restock blocks with journalMovement at resolveDeductionLocation; keep idempotency guard.
- `POST /api/deliveries/batch` — Replace currentStock write + ledger create (route.ts:77-105) with journalMovement(OUTWARD) at resolveDeductionLocation; keep the alreadyDeducted idempotency check.
- `POST /api/inventory/inwards/verify` — BUG: adds to currentStock only (route.ts:33-46). Route through journalMovement(INWARD,+qty) at the transaction's new location column (fallback DEFAULT_STOCK_LOCATION).
- `POST /api/stock-reset` — BUG: zeros Product.currentStock but leaves StockLevel (route.ts:37-40). Also zero the matching StockLevel rows (updateMany quantity:0,reservedQuantity:0) in the same tx.
- `POST/PATCH /api/inbound/[id] and /api/inbound/[id]/status` — Already correct (adjustLocationQty). Refactor the two ledger creates to journalMovement so location moves from notes into the new column. Behaviour unchanged.
- `POST /api/transfer-orders/[id]/approve` — Already correct (from/to adjustLocationQty). Refactor to journalTransfer so the TRANSFER row carries fromLocation/toLocation columns instead of only notes.
- `PATCH /api/stock-counts/[id]` — Location mode already correct (setLocationQty). Route through journalSet to stamp location on INWARD/ADJUSTMENT rows; delete/guard the non-location fallback (route.ts:224-234,257-266) — counts are always location-scoped with bins dormant.
- `POST /api/zoho/import/invoices` — Stamp location on the unverified OUTWARD ledger row (route.ts:57-68). NO deduction here (previousStock==newStock is intentional — deduction happens at delivery verify).
- `POST /api/stock/price-check/[productId]` — REVIEWED, NOT a stock writer: ADJUSTMENT with quantity:0, previousStock==newStock, only costPrice changes (route.ts:50-68). No StockLevel change; leave location null. Not a drift source.
- `POST /api/transfers` — Legacy BIN transfer, dormant (BIN_TRACKING_ENABLED=false); writes count-neutral TRANSFER row (newStock==previousStock), never touches StockLevel — safe today. Superseded by transfer-orders; recommend gating/deprecating. Route via journalTransfer only if bins re-enabled.
- `GET /api/ai/reorder-suggestions` — INV-010: replace vendor.paymentTermDays (route.ts:35,45) with BrandLeadTime.leadDays via a brandId→leadDays Map (default 7); add maxStock to select and cap suggestedQty at max(0, maxStock-currentStock) when maxStock>0.
- `GET /api/reorder` — INV-010: add maxStock to the product select (route.ts:33-40) so the reorder page can cap PO/WhatsApp qty.
- `GET/POST /api/stock/reconcile` — NEW, ADMIN. GET: per-product drift = currentStock - SUM(StockLevel). POST: absorb the delta at the configured sale location via journalMovement(ADJUSTMENT, [RECONCILE]) so SUM(StockLevel)==currentStock. Idempotent (re-run leaves 0 drift).
- `PUT /api/products/[id]` — NO change — already accepts maxStock/reorderLevel/reorderQty/minStock via productUpdateSchema. Only the UI form gains the inputs.
- `PUT /api/settings` — NO code change — reuse existing key/value PUT to store SALE_DEDUCT_LOCATION / SALE_DEDUCT_LOCATION_BCC.

## UI pages
- `/reorder` (DASHBOARD) — Cap qty by maxStock headroom in createPOFromSelected (page.tsx:150), shareOnWhatsApp (175), shareGroupOnWhatsApp (194) and the qty cell (398); add maxStock to the ReorderProduct type. Aggregates must match the source list per master-prompts DASHBOARD audit-fix.
- `/stock/[id]` (DETAIL (with inline FORM edit block)) — Add maxStock, reorderQty, minStock number inputs beside the existing reorderLevel input in the inline Edit Product form (page.tsx:316); visible labels, inputMode numeric per FORM archetype. No new route; API already accepts the fields.
- `/more/stock-reconcile` (SETTINGS/ADMIN) — NEW admin-only page: drift table (product, currentStock, SUM(StockLevel), delta) + Apply button behind a typed confirm; hidden for non-admins in the UI (don't rely on API 403) per SETTINGS archetype audit-fix.
- `/more (or /more/app-logic)` (SETTINGS/ADMIN) — Add a row exposing SALE_DEDUCT_LOCATION (BCH/BCC) as a select showing the current value inline; admin-gated. Optional if Ibrahim confirms a single default is enough.

## Reuse (do not rebuild)
- src/lib/stock-location.ts already has adjustLocationQty / setLocationQty / recomputeCurrentStock — the new journal helpers WRAP these, no reimplementation.
- transfer-orders/[id]/approve and inbound/[id](/status) and stock-counts/[id] are already correct location writers — they become the reference pattern; the journal helper just consolidates + moves location into a column.
- TransferOrderItem.fromLocation/toLocation (StockLocation?) already models the transfer pair — copy the exact type onto InventoryTransaction.
- StockLevel.reservedQuantity already exists for a v2 reservation move.
- AppSetting + GET/PUT /api/settings already provide the config store for SALE_DEDUCT_LOCATION — no new settings infra.
- BrandLeadTime model + /api/brand-lead-time route + /more/brand-lead-times page already exist — INV-010 only reads leadDays.
- productUpdateSchema already includes maxStock/reorderLevel/reorderQty/minStock — the edit UI needs no backend change.
- deliveries idempotency guard (findFirst referenceNo+OUTWARD) already exists — preserve it when swapping in the helper.

## Files to touch
- `prisma/schema.prisma`
- `src/lib/stock-location.ts`
- `src/lib/validations.ts`
- `src/app/api/inventory/outwards/route.ts`
- `src/app/api/deliveries/[id]/route.ts`
- `src/app/api/deliveries/batch/route.ts`
- `src/app/api/inventory/inwards/verify/route.ts`
- `src/app/api/stock-reset/route.ts`
- `src/app/api/inbound/[id]/route.ts`
- `src/app/api/inbound/[id]/status/route.ts`
- `src/app/api/transfer-orders/[id]/approve/route.ts`
- `src/app/api/stock-counts/[id]/route.ts`
- `src/app/api/zoho/import/invoices/route.ts`
- `src/app/api/ai/reorder-suggestions/route.ts`
- `src/app/api/reorder/route.ts`
- `src/app/(dashboard)/reorder/page.tsx`
- `src/app/(dashboard)/stock/[id]/page.tsx`
- `src/app/api/stock/reconcile/route.ts (NEW)`
- `src/app/(dashboard)/more/stock-reconcile/page.tsx (NEW)`

## Build steps (ordered)
- 1. Schema: add location/fromLocation/toLocation + 2 indexes to InventoryTransaction in prisma/schema.prisma; run `npx prisma db push` then `npx prisma generate` (this repo uses db push, no migrations folder — per database-architect.md).
- 2. Helper (src/lib/stock-location.ts): add THREE entry points that every mutation routes through, each wrapping the existing adjustLocationQty/setLocationQty + a ledger create in one tx: journalMovement({tx,productId,location,delta,type,userId,referenceNo,notes,isRgp?,serialCodes?}) for INWARD/OUTWARD/ADJUSTMENT; journalTransfer({tx,productId,fromLocation,toLocation,quantity,userId,referenceNo,notes}) = two adjustLocationQty calls (net-zero total) + one TRANSFER row with from/to; journalSet({tx,productId,location,qty,type,userId,...}) wrapping setLocationQty for stock counts. Each stamps previousStock (product cache pre-change) and newStock (recomputed total) on the ledger row and returns {transaction,newTotal}.
- 3. Helper: add resolveDeductionLocation(tx, productId, preferred): returns preferred if its StockLevel qty>0, else falls back BCH_STORE→BCH_WAREHOUSE→BCC_STORE→BCC_WAREHOUSE (first with qty>0), so StockLevel always decrements where stock actually sits and never silently clamps to 0. Read SALE_DEDUCT_LOCATION from AppSetting.
- 4. Fix primary bug — inventory/outwards POST: add `location` to outwardSchema (default = resolveDeductionLocation(SALE_DEDUCT_LOCATION)); replace the tx.product.update({currentStock}) + inventoryTransaction.create block (route.ts:70-94) with a single journalMovement(OUTWARD, -qty, location).
- 5. Fix deliveries/[id] PATCH and deliveries/batch POST: replace every tx.product.update({currentStock}) + ledger create (deliveries/batch:77-105; deliveries/[id]:171-260) with journalMovement(OUTWARD) at resolveDeductionLocation; keep the existing idempotency guard (findFirst by referenceNo+OUTWARD). Fix the cancel-restock and reserve blocks in deliveries/[id] to move quantity via the helper too.
- 6. Fix inventory/inwards/verify POST: it currently adds to currentStock only (route.ts:33-46) — inflates currentStock above SUM(StockLevel). Route through journalMovement(INWARD,+qty) using the row's new location column (fallback DEFAULT_STOCK_LOCATION).
- 7. Fix stock-reset POST: after zeroing Product.currentStock, also zero the matching StockLevel rows in the same tx (tx.stockLevel.updateMany quantity:0,reservedQuantity:0 for the reset productIds) — today it leaves StockLevel untouched (route.ts:37-40), the same drift.
- 8. Stamp location on the already-correct writers (behaviour unchanged, just move location from notes into the column): inbound/[id] + inbound/[id]/status via journalMovement(INWARD); transfer-orders/[id]/approve via journalTransfer; stock-counts/[id] via journalSet (and delete/guard its non-location fallback path at route.ts:224-234,257-266 since counts are always location-scoped with bins dormant). zoho/import/invoices: stamp location on the unverified OUTWARD row (no deduction — prev==new is intentional).
- 9. INV-010 lead time: in ai/reorder-suggestions GET, drop vendor.paymentTermDays (route.ts:35,45), add brandId to select, fetch a Map<brandId,leadDays> from prisma.brandLeadTime.findMany, use leadDays (default 7) in calcReorderPoint.
- 10. INV-010 maxStock cap: in ai/reorder-suggestions add maxStock to select and cap suggestedQty at headroom = maxStock>0 ? max(0, maxStock-currentStock) : suggestedQty. In reorder GET add maxStock to select; in reorder/page.tsx cap qty the same way in createPOFromSelected (line 150), shareOnWhatsApp (175), shareGroupOnWhatsApp (194) and the display cell (398); add maxStock to the ReorderProduct type.
- 11. INV-010 edit UI: in stock/[id]/page.tsx add maxStock, reorderQty, minStock to editData (line 95) + startEdit (137) + three number inputs beside the existing reorderLevel input (316). No API change — PUT /api/products/[id] already validates them via productUpdateSchema (productSchema.partial(), validations.ts:31-35).
- 12. Reconcile: add POST /api/stock/reconcile (ADMIN) — GET returns per-product drift (currentStock - SUM(StockLevel)); POST absorbs the delta into the configured sale location via journalMovement(ADJUSTMENT) with notes [RECONCILE], so SUM(StockLevel) == currentStock going forward. Add more/stock-reconcile admin page (typed confirm).
- 13. `npm run build` must exit 0; then load real pages: record an outward and confirm SUM(StockLevel)==currentStock and a location-stamped ledger row; run reconcile on the drifted set and re-check counts reconcile.

## Risks
- ⚠️ Deduction-vs-stock-location mismatch: on-hand is seeded at BCH_WAREHOUSE (DEFAULT_STOCK_LOCATION) but the sale default is BCH_STORE. Deducting from an empty STORE row would clamp at 0 and NOT reduce SUM(StockLevel) → new drift in the opposite direction. resolveDeductionLocation fallback chain mitigates it, but the business rule needs Ibrahim (see open items).
- ⚠️ adjustLocationQty clamps at 0, so an OUTWARD larger than the resolved location's qty silently under-deducts. Add a pre-check that throws when total available < qty (outwards already checks currentStock; ensure the per-location resolve can satisfy it).
- ⚠️ Reconcile direction is a judgment call: currentStock reflects real sales (lower), StockLevel is stale-high. Default trusts currentStock and shrinks StockLevel; if wrong it double-counts. Must be idempotent and dry-run-first (GET before POST).
- ⚠️ stock-counts non-location fallback path removal: confirm no live count is created without a location before deleting it, or guard instead of delete.
- ⚠️ zoho/import/invoices intentionally does NOT deduct (prev==new); do not 'fix' it into a deduction or invoices get double-deducted at delivery verify.
- ⚠️ Legacy /api/transfers (bin) writes TRANSFER rows with no location column — if left, movement reports filtering by location will exclude them; acceptable while bins dormant but note it.
- ⚠️ db push (no migrations folder) on a shared Supabase DB — adding nullable columns is safe/backward-compatible, but run against a backup and confirm Product/StockLevel counts before and after.
- ⚠️ Prisma enum reuse: fromLocation/toLocation must be StockLocation? (not a new enum) to stay consistent with TransferOrderItem.

## Open items (ask Ibrahim before/at build — NOT overnight)
- ❓ SALE/DISPATCH DEDUCTION RULE (blocking): default is the selling entity's STORE (BCH_STORE / BCC_STORE), stored in AppSetting and configurable. But (a) how do we know a Zoho invoice / delivery is BCH vs BCC — org id, invoice-number prefix, or a per-delivery field? and (b) when the store has 0 and stock sits in the warehouse, do we auto-fall-back to that entity's warehouse, or require a store transfer first? Proposed default: fall back store→same-entity warehouse→other. Confirm.
- ❓ RECONCILE POLICY: trust currentStock as the true total and shrink StockLevel to match (proposed default), OR trust StockLevel and recompute currentStock? This decides which number becomes canon for the existing drift. Confirm before running the backfill.
- ❓ maxStock CAP SEMANTICS: cap reorder qty at (maxStock - currentStock) headroom, and treat maxStock=0 as 'no cap'. Confirm that's the intended meaning (vs cap at maxStock absolute).
- ❓ Deprecate legacy /api/transfers (bin-mode) now that transfer-orders is the active path, or keep it dormant?
- ❓ v2 confirm: per-location capacity (maxStock per StockLocation) and moving OUTWARD reservation from Product.reservedStock to StockLevel.reservedQuantity are explicitly OUT of this ticket — confirm deferral.

