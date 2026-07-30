# INV ticket program

Clearing the 14 open **Bike Inventory** Tickrt tickets (INV-001…INV-014), foundation-first, in
dependency-ordered waves. Started 2026-07-31. Design was produced by reading the real repo (schema,
every stock writer, auth, integrations) — not from memory.

## Wave plan
| Wave | Tickets | Notes |
|---|---|---|
| 0 · Design | all | This folder: per-feature specs + `schema-additive-delta.md`. Done. |
| 1 · Foundation | INV-001, INV-010 | Stock-ledger unification + capacity wiring. |
| 2 · Features | INV-011, INV-003+005, INV-014, INV-009, INV-006 | INV-003 (enum→table) + INV-014 (Petpooja) need a human. |
| 3 · RBAC | INV-002 | Server-side enforce across ~146 routes, count-reconciled. Highest risk → last. |
| 4 · Ship | — | DB migration + backfills + Vercel deploy, human-gated. |

**Parked (with reason):** INV-004 (needs bank + WhatsApp exports), INV-013 (no per-store sales data
yet), INV-008 (risky refactor, low value).

## Locked decisions
See `OVERNIGHT-BUILD-BRIEF.md` → "Locked decisions". Deduct `BCH_STORE`→warehouse fallback;
CD full-bill / keeps reducing payable / per-vendor; recurring failure ≥2 cycles; every new screen
follows the `bch-ops` archetype.

## Files
- `OVERNIGHT-BUILD-BRIEF.md` — self-contained instructions for the unattended cloud build.
- `spec-INV-001-INV-010.md`, `spec-INV-011.md`, `spec-INV-009.md`, `spec-INV-006.md` — per-feature
  build specs (exact files, steps, risks, open items).
- `schema-additive-delta.md` — the additive (safe) `prisma/schema.prisma` changes + the HELD
  destructive ones.
- `MORNING-REPORT.md` — written by the overnight run: what shipped, what's partial, human follow-up.

## The hard gates (never automated)
Production DB migration (`db push` / the enum→table SQL), all data backfills, and the Vercel deploy
are done by a human with `DATABASE_URL` and a fresh Supabase snapshot in hand. The cloud agent
cannot reach the DB and must not try.
