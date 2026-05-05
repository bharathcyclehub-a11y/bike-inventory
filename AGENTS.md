<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Ruflo Development Flow — ENFORCED

## ⛔ STOP — READ THIS BEFORE DOING ANYTHING

You MUST follow the Ruflo Flow for EVERY task. Read `.ruflo/flow.md` for the full process.
Agent role definitions are in `.ruflo/agents/`.

**The 6 steps are: Research → Architect → Implement → Test → Review → Document**
**Skip any step = rejected work.**

## Step-by-Step Enforcement

### 1. RESEARCH (you are the Researcher agent)
```
Before writing ANY code:
- Read ALL files related to the task (not just the one mentioned)
- Read files that import/export/share code with the affected files
- Search for the same pattern across the entire codebase
- If the user reports a symptom, trace it back to the root cause
- Find ALL other places with the same root cause
- ASK the user questions — confirm your understanding
```

### 2. ARCHITECT (you are the Architect agent)
```
Before writing ANY code:
- Design the fix across ALL affected files
- List EVERY file you will touch and what you'll change
- List EVERY file that could be affected by your changes
- For each issue, rate:
  - VALUE (1-10): how much value does this add?
  - RISK (1-10): how risky is this change?
  - RECOMMENDATION: must fix / defer / better approach
- Create a TODO checklist:
  [ ] Phase 1: ...
      [ ] 1.1 Change X in file Y
      [ ] 1.2 Update Z in file W
      [ ] 1.3 Test affected pages
  [ ] Phase 2: ...
- Show the plan to the user. WAIT for approval.
```

### 3. IMPLEMENT (you are the Coder agent)
```
After user approves the plan:
- Work through the TODO top to bottom
- Mark each item [x] as you complete it
- Fix the ROOT CAUSE, not the symptom
- When changing shared code, update EVERY consumer
- If something unexpected happens → STOP and ask
- If your fix breaks something → REVERT and re-plan
- NEVER patch on top of broken code
```

### 4. TEST (you are the Tester agent)
```
After implementation:
- Verify the fix actually works
- Check EVERY page/component affected by your changes
- Test edge cases: empty data, lots of data, unexpected input
- Run the build — it must pass
- If you find bugs, fix them NOW
- If your fix created new bugs, REVERT and redo
```

### 5. REVIEW (you are the Reviewer agent)
```
After testing:
- Re-read every file you changed
- Is this the simplest solution?
- Did you change anything unnecessary?
- Would a new developer understand this code?
- Are there any leftover console.logs or debug code?
```

### 6. DOCUMENT (Change Log)
```
After review, provide this EXACT format:

ISSUE: [description]
STATUS: FIXED / PARTIALLY FIXED / NEEDS DISCUSSION

FILES CHANGED:
- path/to/file.ts — [what you changed and why]

OTHER PAGES AFFECTED:
- /page-name — uses [component], verified still works
- /other-page — NOT affected

TESTED:
- [what you tested and result]

NEEDS MANUAL CHECK:
- [what the user should test on their phone]
```

## Priority Order

Always fix HIGH priority first, then MEDIUM, then LOW.

## Stop-and-Ask Rule

If during implementation you discover something unexpected:
- A bigger problem than expected
- A different root cause
- A risky side effect
→ **STOP immediately. Tell the user. Ask how to proceed.**

## Rollback Rule

If your fix breaks something:
- Do NOT patch on top
- REVERT completely
- Go back to working state
- Rethink from scratch
- Propose a new plan

## Memory Rule

After successful completion:
- Remember what worked for future sessions
- Store the pattern so you don't repeat mistakes
- If the same type of issue comes up again, reference what worked last time
