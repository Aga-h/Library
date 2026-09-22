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
