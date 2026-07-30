# INV-006 — build spec

**Feature:** Read-only cross-app Command View at /command (Dashboard archetype, CEO/ADMIN-only) IN bike-inventory. It aggregates THIS app's live KPIs plus any BCH app that already exposes a reachable stats/health endpoint, via a pluggable connector registry (each connector = {app, statsUrl, fields}). Apps with no endpoint yet render a muted 'connect later' tile — no fabricated cross-app numbers. Wiring each remote app is a follow-up ticket in that app's own repo.

## Schema delta
- NONE required for v1. The connector registry is a static TS file; remote base URLs + read keys come from env vars (never committed — the BCH commit-guard blocks secrets). No new Prisma model, no column.
- **AppSetting** — OPTIONAL / deferred only. If Ibrahim later wants runtime-editable statsUrls or per-app on/off toggles without a redeploy, reuse the EXISTING AppSetting key/value store with key 'command_connectors' (JSON) as an override layer over the static registry. Still no new model. Do NOT store secret keys in AppSetting (DB is not a secret store) — keys stay in env.

## API changes
- `GET /api/command` — ADD. requireAuth(['ADMIN']) (CEO passes). Server-side fetch of remote connector statsUrls via Promise.allSettled + per-fetch ~4s AbortController timeout. Returns per-app {status:'ok'|'error'|'connect-later', fetchedAt, fields:[{label,value,format}], error?}. connect-later/error carry no numbers. Keys stay server-side (env).
- `GET /api/ops-stats` — NO CHANGE. Currently a stub returning zeros ('moved to Ops Hub'). Do NOT surface its zeros as real KPIs on the command view — treat bike-inventory ops/SOP tasks as connect-later, not '0'.
- `GET /api/health/summary` — REUSE unchanged. Source of this app's criticalAlerts + Today summary for the 'what needs me now' block (already ADMIN-gated).
- `GET /api/public/command-stats (or keyed /api/command-stats?key=)` — OPTIONAL / DEFERRED follow-up. To let OTHER apps' future command views read bike-inventory, add a keyed read-only export mirroring the existing /api/earn-sync pattern (EARN_SYNC_KEY-style). Out of scope for INV-006; file as its own ticket.

## UI pages
- `/command` (Dashboard) — CEO/ADMIN only. Sections: title+last-refreshed; 'what needs me now' (this app's red alerts); per-connector KPI cards (value-as-text, tabular-nums, each tile links out >=44px); muted 'connect later' tiles with NO numbers; SkeletonDashboard load; error/empty states. Mobile-first 390px, no horizontal scroll, Lucide icons only.

## Reuse (do not rebuild)
- requireAuth(['ADMIN']) + AuthError from src/lib/auth-helpers.ts (CEO auto-passes ADMIN gate)
- successResponse/errorResponse from src/lib/api-utils.ts
- AdminDashboard's proven safeFetch(Promise.all) pattern in src/app/(dashboard)/page.tsx for local KPIs (/api/health/summary, /api/deliveries/stats, /api/inbound/stats, /api/accounts/summary, /api/ai/dashboard-insights)
- UI primitives: src/components/ui/card.tsx, badge.tsx, SkeletonDashboard from skeleton.tsx, src/components/dashboard-card.tsx
- AppSetting key/value store (src/app/api/settings/route.ts) — only if runtime connector overrides are wanted later
- Existing outbound cross-app export pattern: keyed GET in src/app/api/earn-sync/route.ts (blueprint for any future 'let others read us' endpoint)
- middleware.ts matcher already whitelists api/public — an unauth health ping, if added, belongs under /api/public/*

## Files to touch
- `src/lib/command-connectors.ts (NEW — registry + types + mapFields helper)`
- `src/app/api/command/route.ts (NEW — ADMIN/CEO server aggregator for remote connectors)`
- `src/app/(dashboard)/command/page.tsx (NEW — Dashboard-archetype command view)`
- `src/lib/menu-config.ts (EDIT — add Command View row, roles ADMIN)`
- `src/lib/nav-config.ts (EDIT — optional desktop extra tab for CEO/ADMIN)`
- `design-system/bch-ops/prompts/pages/command.md (NEW — optional page delta doc)`
- `.env.local (EDIT — add remote statsUrl + key env vars; never commit secrets)`

## Build steps (ordered)
- Gate: repo is on main with only untracked docs dirty (safe). Run `npm run build` once to capture a green baseline (exit 0) before touching anything.
- Create src/lib/command-connectors.ts: export types BchAppConnector {key,label,href,kind:'local'|'remote',statsUrl:string|null,authMode:'none'|'key'|'session'|'internal',fields:ConnectorField[],status:'live'|'connect-later'}, ConnectorField {key,label,path (dot-path into the remote JSON),format:'int'|'inr'|'pct'|'text'}, and ConnectorResult. Add a pure mapFields(json,fields) helper that safely resolves each dot-path (missing/undefined -> null, never throw; answer 'what at length 0?'). Populate the static registry: local=bike-inventory; remote candidates tickrt/bch-kb/bch-content; the rest as status:'connect-later' with statsUrl:null. Read statsUrl+keys from env (e.g. TICKRT_STATS_URL, KB_STATUS_URL, CONTENT_STATS_URL, *_STATS_KEY).
- Create src/app/api/command/route.ts (GET): `await requireAuth(['ADMIN'])` (CEO passes via the CEO->ADMIN rule). Iterate ONLY the remote connectors with Promise.allSettled; each fetch wrapped in an AbortController timeout (~4s) so one slow app can't hang the view. Map via mapFields. Return `{key,label,href,status:'ok'|'error'|'connect-later',fetchedAt,fields:[{label,value,format}],error?}`. connect-later/error carry ZERO field numbers. Use successResponse/errorResponse; catch AuthError -> its status.
- Create src/app/(dashboard)/command/page.tsx (Dashboard archetype, 'use client'): role-gate to CEO/ADMIN (render a not-authorised state otherwise). Fetch LOCAL KPIs client-side reusing the proven AdminDashboard pattern (safeFetch over /api/health/summary, /api/deliveries/stats, /api/inbound/stats, /api/accounts/summary, /api/ai/dashboard-insights) AND fetch /api/command for remote tiles. Layout per Dashboard archetype: (1) title 'Command View' + subtitle + last-refreshed; (2) 'What needs me now' = this app's criticalAlerts (red first); (3) one Card per connector — live apps show KPI tiles (value as text, tabular-nums, format-aware) each linking out (>=44px) to the app href; connect-later/unreachable tiles are muted with a 'Connect later' badge and no numbers. SkeletonDashboard while loading; explicit error + empty states.
- Edit src/lib/menu-config.ts: add a 'Command View' MenuItem (roles ['ADMIN'] so CEO inherits via the more-page filter), href '/command', using an already-imported Lucide icon (e.g. Activity) — add the import only if the chosen icon isn't already imported.
- Edit src/lib/nav-config.ts: add '/command' as a desktop extra tab in getDesktopExtraTabs for CEO and ADMIN (optional; keeps parity with sidebar). Leave NAV_FEATURE_MAP untouched (admin-only route, not permission-gated).
- (Optional) Add design-system/bch-ops/prompts/pages/command.md — a 3-5 line delta noting fields:per-app connector tiles, primary action: tap tile -> open that app, connect-later empty treatment.
- VERIFY: `npm run build` exits 0. Load /command as a CEO/ADMIN account (tiles render, connect-later tiles show NO numbers, fetchedAt visible). Confirm a deliberately-bad statsUrl yields an 'unreachable' tile without hanging the page. Confirm the /command nav row is HIDDEN for a non-admin role and that GET /api/command returns 403 to a non-admin (hide in UI, don't rely on the 403 alone). State plainly what was left as connect-later.

## Risks
- ⚠️ Remote latency/hang: one slow BCH app must not block the whole view — mandatory per-fetch AbortController timeout + Promise.allSettled; degrade that tile to 'unreachable', keep the rest.
- ⚠️ Empty/shape-drift JSON from a remote (length-0, renamed field) must degrade to '—'/omitted, never a thrown 500 — the BCH Upstash empty-input lesson. mapFields guards every dot-path.
- ⚠️ Fabrication risk: connect-later and error tiles must show ZERO numbers. Also do NOT render /api/ops-stats' hardcoded zeros as if real (recall the 'verifiedIssues=0 became a fake stat' incident).
- ⚠️ Auth mismatch on remotes: Tickrt's /api/apps/with-stats is session-gated (requireRole) — NOT server-to-server reachable without a token; do not mark it 'live' until a keyed variant exists in the tickrt repo (follow-up).
- ⚠️ Secrets: remote read keys must live in env, never in the registry, DB, or a commit — the BCH commit-guard will block a staged live credential.
- ⚠️ SSRF/allowlist: statsUrls come only from the static registry/env, never user input — keep it that way.
- ⚠️ Data-exposure: a public health endpoint may only expose status/time, never business KPIs; KPI sharing must be keyed (earn-sync pattern).
- ⚠️ Role leakage: hide the /command nav row for non-admins (don't rely solely on the API 403) — matches the Settings/Admin archetype rule.
- ⚠️ CEO gate: verify requireAuth(['ADMIN']) actually lets CEO through (it does via the CEO->ADMIN branch) — test with a CEO account, not just ADMIN.

## Open items (ask Ibrahim before/at build — NOT overnight)
- ❓ Confirm production URLs (Vercel aliases) for each BCH app to populate the statsUrl env vars — needed before any remote tile can go live.
- ❓ Decide the cross-app read auth: add a shared per-app read key (like EARN_SYNC_KEY) or a keyed public stats route in each app? Wiring each remote endpoint is a follow-up ticket in THAT app's repo.
- ❓ Confirm which KPIs matter per app (the 'fields' spec). Proposed defaults exist, but you own the 'what to show' list.
- ❓ Grounded connector inventory (scanned sibling repos on disk): LIVE-CANDIDATE endpoints already exist for — Tickrt /api/apps/with-stats + /api/landing-pages/with-stats (but AUTH-GATED, needs a keyed variant), BCH KB /api/system-status + /api/sync-status (OPEN, but health-signal not KPIs), BCH Content /api/tracker/stats (OPEN, real KPIs: pipeline stage counts + shots today). NEED an endpoint ADDED — BCH Service (only job-status mutations), 2XG Earn CRM (none; it consumes our earn-sync), BCH Ledger (none), BCH Sales Training (none), BCH YouTube Engine (only a cron sync). UNKNOWN / no local clone — BCH Store Analytics, TeleCRM (connect-later until their endpoints are known).
- ❓ Confirm audience is CEO/ADMIN only (assumed). If wider, we add permission gating instead of a hardcoded admin check.
- ❓ Optional: do you want the deferred outbound keyed /api/command-stats so other apps' command views can read bike-inventory? File as its own ticket if yes.

