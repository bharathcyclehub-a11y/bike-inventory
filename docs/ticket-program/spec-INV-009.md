# INV-009 — build spec

**Feature:** Configurable recurring inventory-failure tracker. Ibrahim defines named failures (name, category, severity, description); staff log one occurrence per audit cycle; the system derives a repeat-count (distinct cycles) and a "Recurring" flag when a failure appears in >= threshold cycles. List archetype = failure catalogue; Detail archetype = one failure + its per-cycle occurrence timeline + repeat flag. Failures are NOT hard-coded/seeded — Ibrahim enters the 6 himself.

## Schema delta
- **FailureSeverity (new enum)** — enum FailureSeverity { LOW MEDIUM HIGH CRITICAL } — severity has <20 fixed values, so enum per database-architect framework (mirrors existing enum-driven-status convention).
- **RecurringFailure (new model)** — id String @id @default(cuid()); name String; category String @default("general") (free-string, configurable — mirrors AppProblem.category, NOT a fixed enum so Ibrahim can name categories); severity FailureSeverity @default(MEDIUM); description String? @db.Text; isActive Boolean @default(true) (soft-delete, not hard delete); createdById String; createdBy User @relation("FailureCreatedBy", fields:[createdById], references:[id]); occurrences FailureOccurrence[]; createdAt DateTime @default(now()); updatedAt DateTime @updatedAt; @@index([isActive]); @@index([severity]).
- **FailureOccurrence (new model)** — id String @id @default(cuid()); failureId String; failure RecurringFailure @relation(fields:[failureId], references:[id], onDelete: Cascade); auditCycle String (cycle label e.g. "2026-Q3" — the repeat-across-cycles key); occurredAt DateTime @default(now()) (the date the ticket mentions alongside auditCycle); note String? @db.Text; status String @default("open") (open/resolved — mirrors AppProblem.status); stockCountId String? (optional link to the StockCount that surfaced it — nullable FK, gets linked later); stockCount StockCount? @relation(fields:[stockCountId], references:[id]); loggedById String; loggedBy User @relation("OccurrenceLoggedBy", fields:[loggedById], references:[id]); createdAt DateTime @default(now()); @@unique([failureId, auditCycle]) (idempotency — one occurrence per failure per cycle; makes repeatCount = occurrence count = distinct cycles); @@index([failureId]); @@index([auditCycle]); @@index([status]).
- **User (edit)** — Add two back-relations next to existing reportedProblems (line ~210): createdFailures RecurringFailure[] @relation("FailureCreatedBy"); loggedFailureOccurrences FailureOccurrence[] @relation("OccurrenceLoggedBy").
- **StockCount (edit)** — Add back-relation for the optional occurrence link (after items[] at line ~453): failureOccurrences FailureOccurrence[].

## API changes
- `GET /api/recurring-failures` — List all failures. Include _count.occurrences; per row derive repeatCount (= occurrence count = distinct cycles, guaranteed by @@unique) and isRecurring = repeatCount >= threshold. Optional ?active=true and ?severity filters. requireAuth(). paginatedResponse or successResponse (list is small; problems uses take:100).
- `POST /api/recurring-failures` — Create a failure definition {name, category?, severity?, description?}. requireAuth([ADMIN,SUPERVISOR]) — only Ibrahim/admins define. Zod: recurringFailureSchema. successResponse(201).
- `GET /api/recurring-failures/[id]` — One failure + all occurrences (ordered by auditCycle desc / occurredAt desc) with loggedBy.name, plus repeatCount, isRecurring, and distinct-cycle list. Next 16 async params (await params).
- `PATCH /api/recurring-failures/[id]` — Update definition (name/category/severity/description/isActive). requireAuth([ADMIN,SUPERVISOR]). Existence check before update.
- `DELETE /api/recurring-failures/[id]` — Soft-delete: set isActive=false (database-architect: soft over hard delete). Admin only.
- `POST /api/recurring-failures/[id]/occurrences` — Log one occurrence {auditCycle, occurredAt?, note?, stockCountId?} for this failure, loggedById = current user. Idempotency via @@unique([failureId,auditCycle]) — catch P2002 and return 409 'Already logged for this cycle'. requireAuth() (broad staff).
- `PATCH /api/recurring-failures/[id]/occurrences` — Resolve/edit an occurrence by {occurrenceId, status?, note?}. Existence check; requireAuth().

## UI pages
- `/recurring-failures` (List) — Sticky header 'Recurring Failures' + admin-only inline 'Define Failure' add-card (mirrors more/problems add-card: name input, category chips, severity chips). Horizontally-scrollable summary chips (All / Recurring / by severity) — the red 'Recurring' chip is the loudest and never buried. Each failure = one >=44px tap card: bold name, muted category, severity pill, right-aligned repeatCount 'N cycles' (tabular-nums); isRecurring cards get a red left-border-accent. SkeletonList while loading; empty = one line + Define action.
- `/recurring-failures/[id]` (Detail) — Back-arrow header (preserves list state) + failure name + severity pill + Recurring flag. Key-facts grid (category, severity, repeatCount, first-seen cycle, last-seen cycle) with tabular values. Primary-action bar near bottom (>=48px): 'Log Occurrence' opens a sheet/inline form (auditCycle text/select + optional note + optional link to a StockCount). Occurrence timeline at bottom: per-cycle rows (cycle label, date, who logged, note, open/resolved). Admin-only: edit definition / deactivate (hidden, not just disabled, for non-admins).

## Reuse (do not rebuild)
- src/lib/api-utils.ts — successResponse/errorResponse/paginatedResponse/parseSearchParams (do not invent a new response shape)
- src/lib/auth-helpers.ts — requireAuth([roles]) / AuthError; CEO auto-passes ADMIN checks
- src/app/api/problems/route.ts — closest existing template (category-as-string, status-as-string, admin-gated PATCH)
- src/app/api/stock-counts/[id]/route.ts — template for Next 16 async-params [id] handler + existence check
- src/components/ui/{card,badge,skeleton} + SkeletonList — list/detail primitives (frontend-engineer conventions)
- src/app/(dashboard)/more/problems/page.tsx — inline add-card + filter-chip + role-gated action pattern to copy for the List page
- src/app/(dashboard)/stock-audit/page.tsx — left-border-accent card + FilterSheet pattern for the loudest overdue/recurring signal

## Files to touch
- `prisma/schema.prisma (edit: enum + 2 models + 3 back-relations)`
- `src/lib/validations.ts (edit: 4 Zod schemas)`
- `src/lib/menu-config.ts (edit: nav entry under Operations)`
- `src/lib/nav-config.ts (edit, optional: featureKey mapping for RBAC gating)`
- `src/lib/ops-constants.ts (edit, optional: RECURRING_CYCLE_THRESHOLD)`
- `src/app/api/recurring-failures/route.ts (new: GET list + POST create)`
- `src/app/api/recurring-failures/[id]/route.ts (new: GET/PATCH/DELETE)`
- `src/app/api/recurring-failures/[id]/occurrences/route.ts (new: POST log + PATCH resolve)`
- `src/app/(dashboard)/recurring-failures/page.tsx (new: List archetype)`
- `src/app/(dashboard)/recurring-failures/[id]/page.tsx (new: Detail archetype)`

## Build steps (ordered)
- 1. Edit prisma/schema.prisma: add FailureSeverity enum, RecurringFailure + FailureOccurrence models, and the 3 back-relations (User x2, StockCount x1). Then: npx prisma format && npx prisma generate && npx prisma db push (this repo uses db push, no migrations folder — additive change, no drops, safe on Supabase).
- 2. Edit src/lib/validations.ts: add recurringFailureSchema { name: min(1), category: string.optional(), severity: z.enum([LOW,MEDIUM,HIGH,CRITICAL]).optional(), description: string.optional() }; recurringFailureUpdateSchema = recurringFailureSchema.partial().extend({ isActive: z.boolean().optional() }); failureOccurrenceSchema { auditCycle: min(1), occurredAt: string.optional(), note: string.optional(), stockCountId: string.optional() }; occurrenceUpdateSchema { occurrenceId: string, status: z.enum([open,resolved]).optional(), note: string.optional() }.
- 3. (optional) Add RECURRING_CYCLE_THRESHOLD = 2 to src/lib/ops-constants.ts so the repeat rule is one named constant, not a magic number in three files.
- 4. Create src/app/api/recurring-failures/route.ts — GET (list, include _count.occurrences, derive repeatCount + isRecurring = repeatCount >= threshold, support ?active & ?severity) and POST (create, requireAuth([ADMIN,SUPERVISOR]), Zod). Follow api/problems/route.ts + api-utils response shape.
- 5. Create src/app/api/recurring-failures/[id]/route.ts — signature { params }: { params: Promise<{ id: string }> }; await params (Next 16). GET (failure + ordered occurrences + user names + repeatCount + distinct-cycle list), PATCH (update definition/isActive, admin), DELETE (soft-delete: set isActive=false, admin). Follow api/stock-counts/[id]/route.ts.
- 6. Create src/app/api/recurring-failures/[id]/occurrences/route.ts — POST (log occurrence; catch Prisma P2002 on @@unique → errorResponse('Already logged for this cycle',409)) and PATCH (resolve/edit an occurrence by occurrenceId). requireAuth() for POST (broad staff).
- 7. Create src/app/(dashboard)/recurring-failures/page.tsx — LIST archetype (client component, useState+fetch pattern, SkeletonList, empty state).
- 8. Create src/app/(dashboard)/recurring-failures/[id]/page.tsx — DETAIL archetype (back-arrow header, key-facts grid, Log-Occurrence action, occurrence timeline).
- 9. Edit src/lib/menu-config.ts: add nav row under the 'Operations' section near Stock Audit (line ~76). Optionally add '/recurring-failures': 'stock_audit' to src/lib/nav-config.ts if reusing that featureKey for RBAC.
- 10. Run npm run build (must exit 0 — build script is 'prisma generate && next build'). Then load /recurring-failures and /recurring-failures/[id] on a 390px viewport and verify list, add, log-occurrence, and the Recurring flag.
- 11. Do NOT seed the 6 failures — Ibrahim enters them via the UI. State this explicitly at handoff.

## Risks
- ⚠️ Repeat-flag semantics undefined: 'repeats across cycles' — is the flag any >=2 cycles, a configurable N, or consecutive cycles? Spec defaults to isRecurring = distinctCycles >= 2 via one constant (RECURRING_CYCLE_THRESHOLD). Ibrahim must confirm the number and whether 'consecutive' matters.
- ⚠️ auditCycle has no source-of-truth in the schema: StockCount has countNo (SC-YYYYMM-NNNN) and dueDate but NO quarter/cycle concept. auditCycle is a NEW free-text/select field the user types (e.g. '2026-Q3'). Inconsistent labels ('Q3' vs '2026Q3') will silently split what should be the same cycle and under-count repeats — needs a canonical format or a dropdown of allowed cycle labels.
- ⚠️ @@unique([failureId, auditCycle]) forbids more than one occurrence of the same failure in the same cycle (by design, so repeatCount = distinct cycles). If Ibrahim wants multiple hits per cycle, drop the unique and compute repeatCount as COUNT(DISTINCT auditCycle) instead — confirm before building.
- ⚠️ Role gating split (define = ADMIN/SUPERVISOR, log = broad staff) is an assumption; confirm who may create failures vs log occurrences.
- ⚠️ npm run build runs prisma generate + db push against shared Supabase — additive only (new enum/tables/nullable FK), no drops, low risk, but the repo may carry other uncommitted schema WIP; re-check git status --short on prisma/schema.prisma before pushing.
- ⚠️ Next 16: [id] route handlers and page params are async (params: Promise<...>, must await) — getting this wrong builds but throws at runtime.

## Open items (ask Ibrahim before/at build — NOT overnight)
- ❓ Define the repeat rule: flag as Recurring at how many cycles (default 2), and must they be consecutive?
- ❓ Give the canonical audit-cycle label format (quarters like '2026-Q3'? weekly? monthly?) so occurrences don't fragment — and whether it should be a free-text field or a fixed dropdown.
- ❓ Confirm one-occurrence-per-cycle (current design) vs allowing multiple logs of the same failure within a single cycle.
- ❓ Confirm who can DEFINE failures (proposed ADMIN/SUPERVISOR) vs who can LOG occurrences (proposed all staff).
- ❓ Confirm the 6 failures are entered by you via the UI (not seeded) — and provide the initial category names/severities you want available.
- ❓ Should an occurrence optionally link to the specific StockCount/audit that surfaced it (spec includes an optional stockCountId), or stay standalone?

