# Development Rules

## Workflow: ASK → PLAN → BUILD → VERIFY
1. **ASK**: Questions before coding. Confirm understanding.
2. **PLAN**: List files to change. List files that might break. Get approval.
3. **BUILD**: Fix root cause across ALL affected files. One change at a time.
4. **VERIFY**: Run `npm run build`. Open the page. Check it works. Check nothing else broke.

## Verification (MANDATORY after every change)
```bash
npm run build
```
If build fails, fix it before anything else. Never skip this.

## Rules
- Never patch. Fix the actual cause.
- Never say "done" without running the build and checking the page.
- Never change shared code without updating every file that uses it.
- If your fix breaks something, revert and re-plan.
- If unsure, ask. Don't guess.

## Next.js
Breaking changes from your training data. Read `node_modules/next/dist/docs/` first.
