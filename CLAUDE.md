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

## Domain Consultants
When working on features in these domains, read the relevant agent file FIRST and check your implementation against their principles and red flags:

- **Inventory / Stock / Reorder / Products**: Read `docs/agents/inventory-consultant.md`
  - Applies to: stock pages, inbound, reorder, product CRUD, stock audit, transfers
- **Warehouse / Bins / Dispatch / Inbound receiving**: Read `docs/agents/warehouse-consultant.md`
  - Applies to: inbound shipment flow, bin management, delivery dispatch, handover checklist
- **Accounting / Bills / Payments / Receivables / Expenses**: Read `docs/agents/accounting-consultant.md`
  - Applies to: bills, payments, receivables, expenses, settlement, GST, Zoho sync

Before completing any feature in these areas, verify:
1. Does the implementation violate any principle listed in the agent doc?
2. Would the agent raise any red flag about this change?
3. If yes, flag it to the user before marking done.
