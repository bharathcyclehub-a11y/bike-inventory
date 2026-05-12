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
