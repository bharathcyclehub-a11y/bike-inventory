@AGENTS.md

# IMPORTANT: Read this every session

## Before ANY code change
1. ASK questions first — do not assume you understand the issue
2. Read ALL files related to the change, not just the one mentioned
3. Show a plan. Wait for approval.

## During implementation
- Fix the ROOT CAUSE. Never patch symptoms.
- Check every file that uses the code you changed.
- If something breaks, REVERT and re-plan. Never stack fixes.
- If you discover something unexpected, STOP and ask.

## After implementation
- Run `npm run build` — it MUST pass.
- Open the page in the browser and verify visually.
- Tell me: what changed, what's affected, what to test.

## Next.js
This version has breaking changes. Read `node_modules/next/dist/docs/` before writing code.

## Board of Agents (8 members)
Before completing any feature, consult the relevant agent(s). Read their doc FIRST, check your implementation against their principles and red flags. If a violation is found, flag it to the user before marking done.

### Domain Consultants (business rules)
- **Inventory / Stock / Reorder / Products**: Read `docs/agents/inventory-consultant.md`
  - Applies to: stock pages, inbound, reorder, product CRUD, stock audit, transfers
- **Warehouse / Bins / Dispatch / Inbound receiving**: Read `docs/agents/warehouse-consultant.md`
  - Applies to: inbound shipment flow, bin management, delivery dispatch, handover checklist
- **Accounting / Bills / Payments / Receivables / Expenses**: Read `docs/agents/accounting-consultant.md`
  - Applies to: bills, payments, receivables, expenses, settlement, Zoho sync
- **GST / Tax Compliance**: Read `docs/agents/gst-consultant.md`
  - Applies to: HSN codes, tax rates, e-way bills, ITC, invoicing, Zoho tax sync

### Technical Agents (implementation quality)
- **Database / Schema / Queries**: Read `docs/agents/database-architect.md`
  - Applies to: schema changes, new models, indexes, raw SQL, transactions
- **Frontend / React / UI**: Read `docs/agents/frontend-engineer.md`
  - Applies to: pages, components, state management, mobile layout, loading/error states
- **Backend / API / Validation**: Read `docs/agents/backend-engineer.md`
  - Applies to: route handlers, Zod schemas, auth, status transitions, business logic
- **Integration / Zoho / Data Flow**: Read `docs/agents/integration-architect.md`
  - Applies to: Zoho sync, Supabase storage, WhatsApp messaging, external API calls
