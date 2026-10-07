# BCH development rules — read before writing anything

Shared across every Bharath Cycle Hub repo. Each rule was written after a real mistake that
reached Ibrahim and cost him time or money. Kept short on purpose: this file loads into every
session, so every line has to earn its tokens.

Repo-specific rules live in `DEV_FEEDBACK.md` (see the bottom). This file is the floor, not the
whole story — the repo's own `CLAUDE.md` / `AGENTS.md` still wins on anything local.

---

## The one rule

**Never write a fact you have not read.**

Every failure this project has paid for is this one mistake in different clothes: a claim produced
from memory, from a handover document, or from a plausible inference — instead of from the file,
the repo, the API, or the running page.

What it has actually cost:

| mistake | cost |
|---|---|
| App paths written as `~/Desktop/<name>` instead of `~/Desktop/app files/<name>` | a whole feature dead in production on 8 apps |
| Ticket steps fed as plain strings when the type is `{description, file}` | 28 action plans rendered blank; Ibrahim found it, no test did |
| Auth added to `POST`/`DELETE` only, never to a single `GET` | `FAIL forged owner cookie -> got 200, expected 401` — a real hole, shipped |
| `verifiedIssues` hardcoded `0`, then summed into a real total | a fake statistic on the dashboard for weeks |
| An action plan naming `src/app/layout.tsx` in a **Vite** repo | a developer would create files that do nothing |
| Git author not on the Vercel team | **75 days** of silently blocked deploys |
| A ticket citing "26 alerts" and "6 breakpoints" | real numbers were **52** and **198** |

---

## Gates — run these, do not skim them

**Before touching the repo at all.** Most of these repos carry someone's uncommitted work.

```bash
git status --short          # is someone mid-change here?
git branch --show-current   # are you where you think you are?
git log -1 --format='%ae'   # BEFORE blaming any build
```

Dirty tree or unexpected branch: **say so and ask.** Never stash, reset, checkout or commit
someone else's work-in-progress to clear your path. Never `git add -A` in a dirty repo — stage
only the files you touched, by name.

**Before naming a file, a framework or a version.** Your training is a rumour about the installed
version; the installed version is the only version.

```bash
head -40 package.json                     # which framework, which VERSION
test -f <the-exact-file> && echo EXISTS || echo "DOES NOT EXIST"
node -p "require('./node_modules/<pkg>/package.json').version"
ls node_modules/next/dist/docs/ 2>/dev/null   # Next ships local docs — read them
```

**When the change is a rule** ("every route needs auth", "every card needs a key"), enumerate and
reconcile. Eyeballing is how the auth hole shipped.

```bash
comm -23 <(grep -rl '<the pattern the rule applies to>' src | sort) \
         <(grep -rl '<the thing the rule requires>'     src | sort)
```

If that prints anything, you are not done.

**Before commit.** No placeholder ever reaches a commit. If a value is not real yet it throws, or
it is absent — it never renders as though it were true.

```bash
git diff --cached | grep -nE '^\+.*(TODO|FIXME|XXX|hardcod|placeholder|= 0; //)'
```

**Never commit a credential.** A live Razorpay secret sat in a PUBLIC repo in this org from its
initial commit. Deleting the file does not fix it — history, clones and forks all keep the value.
Rotation is the only fix. A `PreToolUse` guard now blocks this automatically, but know why.

---

## Things that are true here and surprise people

- **Empty is a real input.** Upstash Redis **throws on an empty pipeline** — that shipped as
  `SyntaxError: Unexpected end of JSON input`. For every collection operation, answer out loud:
  what happens at length 0?
- **A tool's recommendation is a hypothesis.** `npm audit` said "fix available via next" — false,
  `next` still hard-pinned vulnerable transitive deps. The same command advised downgrading `next`
  to `9.3.3`. Check the lockfile, not the advice.
- **A green CLI is not proof.** Vercel reported nothing for a blocked deploy; `vercel inspect` said
  only `status UNKNOWN`. The cause existed solely in the REST API (`seatBlock`,
  `readyStateReason`). Fetch the thing and look at it.
- **Next 16 renamed `middleware.ts` to `proxy.ts`**, and its own docs say it must not be the
  authorization layer — only an optimistic check. Real checks go in the route.

---

## Deploying

```bash
git log -1 --format='%ae'                  # must be a Vercel team member, or the build is skipped
npx vercel --prod --yes --archive=tgz      # --archive=tgz matters; plain uploads have hung
```

Afterwards confirm the alias moved **and** that the site serves the new code.

---

## Definition of done

`npm run build` passing is the **floor**, not the finish line. Done means all four:

1. `npm run build` exits 0 — report the exit code, not an impression of it.
2. The behaviour is observed where it matters — load the real page, hit the real URL, send the bad
   request and confirm it is refused.
3. Every count reconciles against the source of truth.
4. What you deliberately did **not** do is stated plainly.

A ticket marked `done` that is not done costs Ibrahim a verification pass and teaches him the
status column lies. That is more expensive than the bug.

---

## Ticket discipline (board: https://tickrt-issue-app.vercel.app)

- You may set `in-progress` and `done`. **Only Ibrahim sets `verified`** — the server returns 403
  by design. A developer who signs off their own work is not a check.
- Read the **full** description, never the title. Voice-fed tickets carry the real spec below the
  first line.
- Name only files you have confirmed exist. Every step must be checkable by a command or by
  looking at something — a step nobody can satisfy makes the ticket uncloseable.
- One ticket at a time, finished. Half-doing six is worse than finishing one.

---

## When you get it wrong anyway

One line, plainly, then carry on — "the plan named Next.js files in a Vite repo, my error." No
apology paragraph, no tally. Then fix the **class**, not the instance: if one thing was written
from a document instead of the code, everything written that way is suspect.

---

## Repo-specific rules

Findings and rules that apply only to **this** repo belong in `DEV_FEEDBACK.md` next to this file.
Add to it as you learn; that is how this repo stops repeating its own mistakes rather than only the
shared ones.
