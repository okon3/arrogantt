---
name: verify-ui
description: Verify a change in the running app — computed styles, model state, a screenshot — through scripts/ab.mjs. Use after any edit to src/gantt that a user could see, when asked to check, measure or screenshot the UI, or before claiming a visual or behavioural change works.
---

# Verify UI

User-visible behaviour is verified in the running app, never asserted from
code. `scripts/ab.mjs` is the way in: it wraps `agent-browser` so that the
session is named, scripts travel as base64, the app is mounted before the
first read and the pointer is parked before a capture. Call `agent-browser`
bare only for what the wrapper passes through (`click`, `mouse`, `snapshot`,
`press`, `set`).

Run it through the PowerShell tool: `node` is not on the Bash tool's PATH.

## The loop

1. **Server.** `Get-NetTCPConnection -LocalPort 5173` — the port is the
   mutex. After a structural CSS change, an `npm install` or a renamed
   module-level constant: `npm run dev:fresh` (backgrounded) first.
2. **Open**, in a session name of your own (one per agent, never `default`):
   `node scripts/ab.mjs --session <name> open --demo`
   Add `--scheme dark|light` and `--viewport 1800x612@2` as needed. Later
   calls reuse the session; do not reopen between reads.
3. **Fixture.** `--demo` for looks; for behaviour build the smallest plan
   through `window.arrogantt` in a file and `eval <file.js>` it. Read
   `arrogantt.help()` for the surface.
4. **Measure** the cell you changed:
   - `style <selector> <property>...` — computed values and the match count.
     `matched: 0` is a reading of the selector, not of the feature.
   - `probe [taskId...]` — grid row, timeline row and bar per task.
   - `eval -e "<js>" --retry` — any read of the model or the DOM.
5. **Capture** only what a reader needs to see: `shot <path.png>`.
6. **Report** what was driven, the values read, and what was not driven.

## How much, by tier

The tier comes from what the diff touches (`.claude/orchestrate.md`).

- *Polish*: `style` on the changed cell before and after, one `shot` pair in
  light; dark only when a token that differs by scheme moved. Stop there.
- *Feature*: every accept cell of the brief driven, plus the not-driven list.
- *Engine*: the tests are the proof; the browser adds one read of
  `arrogantt.getSolved()` on a fixture that exercises the change.

## What the wrapper cannot do for you

- **Before means before.** Take the "before" reading on the code as it was
  (`git stash`, or read it first), not from memory of the stylesheet.
- **`eval` without `--retry` is never re-run.** If it fails to report, the
  work may have landed: read the state back before running it again.
- **`isDirty()` and `getFilename()` lag a write** by a render: read them in a
  separate `eval` from the write.
- **Chain calls with `&&`**, never `;` — a failed call must stop the chain.
- **An absence needs its positive control**: show the same probe finding the
  thing once before reporting that it is gone.
- Keys, dialogs, print, link drags, animations and text-fit measurements each
  have a trap of their own: read the matching section of
  `docs/verification.md` before driving one of them, and only that section.
