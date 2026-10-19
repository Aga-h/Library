<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Session continuity

The container is wiped between sessions and there is no warning before a session ends, so state
must live in git and be written as work happens — never saved on the way out.

`.claude/PROGRESS.md` is that state. A SessionStart hook prints it into context automatically, so
it is already loaded when a session opens.

- **Read it first.** If the user says "continue" (or anything equivalent), resume at the first
  unchecked item under **Next** — don't re-plan work that is already checked off under **Done**.
- **Keep it current.** Update it as part of each normal commit, and commit it on its own
  *before* starting anything long or destructive. Assume the session can die at any moment.
- **Rewrite in place**, don't append — it is a snapshot, not a log. Keep it short enough to scan.
- **Anything the user must do by hand goes under "Blocked / needs the user"** — pending SQL,
  env vars, dashboard settings. Chat scrollback is not storage; things stated only in chat get
  lost between sessions.

# How to work

The user asked for these on every change in this repo. They come up in this order.

**Understand before changing.** Read the code you are about to touch, and enough of what calls it
to see how it is used. Do not edit from memory. Look up what you can: call sites, config, what an
API actually returns. Do not ask the user for those, and do not assume. Before writing Next.js
code, read the guide in `node_modules/next/dist/docs/` — the block at the top of this file is why.

**Fit in.** New code should look like the code around it: naming, idioms, comment density,
error handling. This codebase's conventions win. Reuse helpers that already exist (`withErrors`,
the shared form helpers) before adding new ones.

**Keep the change small.** Do what was asked. Do not refactor nearby code, add an abstraction
for a single use, or "improve" something outside the task in the same change. If something else
is worth fixing, say so instead of widening the diff. Simple and direct beats clever.

**Correctness.** Handle the edge cases real inputs hit: empty values, failed requests, bad query
params. Do not defend against things that cannot happen. Validate input at the edges. No path
traversal, no leaked secrets, auth checks where they belong.

**Verify, then say what you actually did.** Before calling something done, run this repo's checks:
lint, typecheck, tests, and the app itself when the change is UI. If something fails, say so and
show the output. If a step was skipped or could not be run, say that too.

**Hard to undo.** Before deleting files, rewriting history, running migrations, or pushing, check
what is there. The standing order for this repo is still to land finished work on `main` — Vercel
deploys `main` only. Do not force-push, do not rewrite someone else's commits, and do not skip or
disable a test to get a check green.

**Leave a trail.** Commits are focused and say why. Update `.claude/PROGRESS.md` with the work,
as the section above describes. Hand work (SQL, env vars) goes under "Blocked / needs the user".

**Use judgment.** When there is a sensible default, pick it and say what you chose. Ask only when
the decision is the user's: product direction, or a tradeoff where either choice loses something.
