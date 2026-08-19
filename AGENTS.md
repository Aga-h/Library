<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
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
# Use the knowledge graph before reading the tree

`graphify-out/` holds a graphify knowledge graph of this repo — 1398 nodes, 2620 edges, 154
labelled communities — and it is **committed on purpose** so it survives a container wipe.

**For any question about how this codebase fits together, query the graph first.** What calls
what, where a symbol lives, what a change would ripple into, which module bridges two areas:

```
graphify query "how does the expense queue reach the database"
graphify path "HierarchyForm" "TvSeries"      # shortest path between two things
graphify explain "withErrors"                 # plain-language account of one node
```

Reach for `grep`/`Read` when the graph has answered *where* and you need the exact current text
of a file — not as the opening move across the whole tree.

## What the graph is not

- **It is a snapshot, not live.** It knows the code as of the last `/graphify .`. Anything
  edited in the current session is invisible to it. Never answer from the graph about code you
  just wrote — read the file.
- **It has no runtime state.** It is a static map of source. It cannot tell you whether a
  migration applied, whether a row is duplicated, or what an API actually returned. Schema and
  behaviour changes are still verified against a real Postgres and real HTTP calls — that is
  what caught the duplicate expenses and the migration that broke books.
- **It does not know your data.** Nothing in it reflects the contents of the Supabase database.

## Updating it

The user re-runs `/graphify .` after major changes. Whoever runs it must then:

```
npm run graph:seal     # inline vis-network into graph.html, SRI-verified
```

graphify writes `graph.html` pointing at unpkg, which is dead anywhere the network is blocked —
offline, and inside the Claude artifact viewer. `graph:seal` fixes that and is a no-op if
already sealed. Then commit `graphify-out/`.

`.graphify_python` is gitignored: it holds an absolute path to a container-local interpreter and
would misdirect the next session.
