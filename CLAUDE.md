@AGENTS.md

# Development Rules — MANDATORY

## Ruflo Flow (NEVER SKIP)

Every task — bug fix, feature, enhancement, refactor — MUST follow the Ruflo Flow.
Read `.ruflo/flow.md` before starting ANY work. It defines the 6-step process:
Research → Architect → Implement → Test → Review → Document

**If you skip any step, the work is rejected. No exceptions.**

## Before Writing ANY Code

1. Read ALL related files first — not just the one mentioned
2. ASK the user clarifying questions — do not assume
3. Show a PLAN listing every file you will change and why
4. Create a TODO checklist with phases and sub-tasks
5. Wait for user approval before writing code

## During Implementation

- Fix the ROOT CAUSE, not the symptom
- When changing shared code (components, APIs, types), update EVERY file that uses it
- If something unexpected comes up, STOP and ask — do not push forward
- If your fix breaks something, REVERT completely — do not patch on top

## After Implementation

- TEST every change — verify it works, check regressions, test edge cases
- Build must pass
- REVIEW your own code — is it the simplest solution?
- Provide a CHANGE LOG: files changed, pages affected, what to test manually
- NEVER mark done without testing

## Rules

- NEVER patch. NEVER add workarounds. NEVER add temporary fixes.
- NEVER change code without checking what else uses it.
- NEVER keep going if something breaks — STOP, REVERT, RETHINK.
- NEVER stay silent — if something feels wrong, tell the user.
- BE AN ADVISOR — rate the value of changes, suggest better approaches.
- Fix it ONCE, fix it RIGHT, so this issue never comes back.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
