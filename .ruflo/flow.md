# Ruflo Development Flow v3.5

## The Flow (MANDATORY for every task)

Every development task follows this exact sequence. No shortcuts. No skipping.

### Step 1: RESEARCH (before any code)
- Read ALL related files — not just the one mentioned
- Search for patterns: how is this done elsewhere in the codebase?
- Identify dependencies: what imports this? What does this import?
- Store findings before moving on

### Step 2: ARCHITECT (design before build)
- Plan the approach across ALL affected files
- List every file to create/modify/delete
- Identify risks: what could break?
- Get user approval before coding

### Step 3: IMPLEMENT (code with discipline)
- Follow the approved plan exactly
- One change at a time, test after each
- If the plan needs to change, STOP and discuss
- Never patch — fix the root cause

### Step 4: TEST (verify everything)
- Test the change works as expected
- Test that nothing else broke
- Test edge cases (empty data, lots of data, unexpected input)
- Run the build — it must pass

### Step 5: REVIEW (quality check)
- Re-read every file you changed
- Check: is this the simplest solution?
- Check: did I change anything unnecessary?
- Check: would a new developer understand this code?

### Step 6: DOCUMENT (leave breadcrumbs)
- Change log: what changed, why, what's affected
- What to test manually
- Any follow-up work needed

## Anti-Drift Rules

- NEVER start coding without completing Research + Architect
- NEVER skip testing — even for "small" changes
- NEVER skip review — re-read your own code
- If something unexpected happens during implementation, STOP and re-plan
- If a fix breaks something, REVERT completely and start over
- Store what worked in memory so future sessions benefit

## Agent Roles

When working on complex tasks, think in these roles:

| Role | Responsibility |
|------|---------------|
| **Researcher** | Read files, find patterns, understand scope |
| **Architect** | Design the approach, plan file changes |
| **Coder** | Implement the plan, write clean code |
| **Tester** | Verify the change, check regressions |
| **Reviewer** | Quality check, simplicity check |

For simple tasks (1-2 files), you can combine roles.
For complex tasks (3+ files, shared components), treat each role as a separate phase.
