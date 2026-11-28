# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

ARROGANTT is a single-user Gantt planner that runs entirely in the browser: no
backend, no accounts, no database. Effort and start are inputs; the engine
derives every end by simulating people's capacity. It began as its author's own
tool and is now published: anyone may be using the live build and keeping
`.gantt` files written by it. Stack: TypeScript, React, Vite, vitest, oxlint;
dhtmlx-gantt (Community) only renders. The commands are under *Commands*. A
push to `master` publishes the live build (`.github/workflows/deploy.yml`,
GitHub Pages).

Public contracts — what users, their files and their scripts depend on:

- the `.gantt` format: v2 written, v1 still loads (`docs/file-format.md`);
- `window.arrogantt`, with `agentApi.help.md` (`help()`, `/llms.txt`) as its text;
- the CSV export's columns (`planCsv.ts`);
- the `arrogantt.*` localStorage values — the draft above all: it can hold the
  only copy of unsaved work;
- the scheduling semantics under *Invariants* and *Day-boundary rule*.

## What you can do without asking

Read any file; run builds, tests and the linter; create branches and worktrees,
commit to them locally and push them; refactor internal code; add or update
tests and documentation. Work on a branch, not on `master`: branches are what
lets several pieces of work run in parallel and be integrated one at a time.

## Ask for approval before

- changing the observable behaviour of an existing feature or of a contract
  listed under *Project*
- changing what the `.gantt` parser accepts or writes, or the shape of a stored
  `arrogantt.*` value — this project's schema and data migrations
- adding a new dependency or upgrading one across a major version
- touching `.github/workflows/`, the build modes in `vite.config.ts`, or
  anything else that decides what gets deployed
- deleting files outside the area you are working on

Do not push to `master` or merge into it: a push there deploys, and the human
owner of the repository reviews and integrates branches. `.githooks/pre-push`
refuses it from an agent's shell (`git config core.hooksPath .githooks`, once
per clone).

## Finishing work

Keep working until the task is done. Treat ordinary obstacles (failing tests,
errors, timeouts, empty results) as problems to diagnose and work through, not
as reasons to stop. While you wait for an answer on an open decision, carry on
with the parts that don't depend on it. Stop only when the next step truly
needs input, or when you meet a boundary that someone set on purpose — here
that includes the 80% rule under *How good is good enough*.

## Delegated work

If you are working on a brief delegated by another agent, stay within the goal
and the files of that brief. If you find duplicated code or related problems
outside it, describe them in your result instead of changing them.

## Commands

```bash
npm run dev            # Vite dev server on :5173 (strictPort: fails if taken)
npm run dev:fresh      # same, after killing whatever still holds :5173
npm test               # vitest run
npm run test:watch
npm run build          # tsc -b && vite build
npm run build:single   # everything inlined into one index.html
npm run lint           # oxlint
npx vitest run src/scheduler/availability.test.ts   # one file
npx vitest run -t "compounds a reduced period"      # one case
```

No vitest config file: it runs off `vite.config.ts`, which only keeps
`.claude/` (agent worktrees) out of the run.

On Windows run npm through the PowerShell tool (backgrounded with the tool's
own flag), never via `Start-Process npm`: `npm.ps1` opens in an editor instead
of running. After a structural CSS change, an `npm install` or a renamed
module-level constant, `npm run dev:fresh` before trusting any negative verdict
from the browser — HMR serves stale stylesheets and modules here. The port is
pinned, so a server that refuses to start means an old one is still up.

## Architecture

| Path | Role |
| --- | --- |
| `src/scheduler` | Engine. No framework, no UI imports, no dhtmlx. |
| `src/gantt` | View: dhtmlx wiring, file format, dialogs, rendering. |

The engine does not know the view exists — the rendering library is replaceable,
the scheduling semantics are not.

**Effort and start are inputs; end is derived.** The one end the UI may write
is `fixedEnd`, which makes the task a record the engine replays, not schedules. `simulate.ts` is a discrete-event simulation on
a **working-minutes** axis (no calendar logic in the loop; `WorkingCalendar` owns
conversions). Extension seam: `allocation.ts` — receives already-resolved
capacity, never sees calendars. Read [docs/scheduling.md](docs/scheduling.md)
before changing the engine.

## Invariants (each pinned by a test)

If one fails, the semantics changed, not the test.

- **Effort conserved**: Σ(rate × duration) over a task's segments = its effort
  (on a task with `fixedEnd` the effort is that sum: the estimate is ignored).
- **A fixed task is moved by nothing**: no predecessor, no contention, no
  absence changes its start or its end.
- **A summary is never scheduled** (it would contend with its own children).
  Effort/dates/resource roll up from leaves; the file omits its `resourceId`.
- **Dependencies are pushed down to leaves**, on both ends of a link.
- **An availability override replaces the default** (never multiplies);
  **overlapping overrides: last declared wins**. Absence = override at zero.
- **A derived start is never a constraint.** Everything shows the solved start
  and hands it back on save, so `constraintStart` (`project.ts`) accepts a start
  only while it differs from the solved one — else a rename walks the constraint
  forward.
- **A declared start is a working day**: snapped to its opening; closed day →
  next open one.
- **`project.tasks` order = row order.** `onAfterTaskMove` reports only the new
  parent, so reorders must be read back off the grid (`getChildren`, not
  `eachTask`).
- **A task with no resource never contends** (full rate); the concurrent-task
  split applies **on top** of the resource's current capacity.

## Day-boundary rule

A working-minute on a day boundary = two instants (17:00 / next 08:00) —
`fromWorkingMinutes(minutes, edge)`. **Compare working minutes, not dates, for
adjacency**, and **never convert a schedule's minutes a second time**: read the
`Date` it carries (the builder already chose a boundary side; a second conversion
silently picks its own). `pinMilestones` and `rollUp` exist for this. Details:
[docs/scheduling.md](docs/scheduling.md).

## dhtmlx-gantt

Community build, rendering only. Typings don't distinguish Community from PRO,
and `plugins()` is silent about what the build lacks. **Read
[docs/dhtmlx.md](docs/dhtmlx.md) before touching code that talks to the
library.** Fastest biters:

- Never `gantt.destructor()` — `clearAll()`; StrictMode remounts.
- Bar colours via `--dhx-gantt-task-background` (inline per task); never
  override `background` in a stylesheet.
- Refuse links in `onBeforeLinkAdd` (later is too late — model already mutated).
- Editing rules go on `inlineEditors.attachEvent('onBeforeEditStart')` — every
  way in passes through it.
- Nothing `gantt.init()` depends on may change identity per render — parent
  callbacks go into refs.
- Verify visuals with `getComputedStyle`; off-screen bars have no DOM node.

## Agent API

`window.arrogantt` (`src/gantt/agentApi.ts`) is an **adapter, not a feature**: every
op delegates to the same `GanttHandle` the buttons use — a rule must never exist
in both. Three deliberate departures: nothing confirmed, errors throw, patches
partial. Expose an op only when a script can't compose it from what exists.
`agentApi.help.md` **is** `arrogantt.help()` and `/llms.txt` (one file, `?raw` import
+ Vite plugin) — never a second copy; update it in the same commit that moves the
surface.

Data flow: edit → pull into model → `solve()` → write onto dhtmlx tasks →
`refreshData()` (fires no update events; an `applying` flag guards the rest).

## Undo and the draft

`history.ts`: whole-project snapshots, recorded in the chart's `onChange` — the
single funnel for every model change. An edit path not ending in `applySolution`
is outside the undo history: route it there, never push snapshots of your own.
`dirty` is **derived** (snapshot vs last-saved text) — never reintroduce a
`setDirty`. Restore goes through `loadProject`, like a file open; only viewport
handling differs.

The autosaved draft is read at **first render**, not in an effect (the sync
effect clears it on mount), and must not be cleared while its question is on
screen — storage holds the only copy until answered.

## File format

`.gantt` JSON v2 (v1 loads: `daysOff` → overrides at zero). Inputs decide the
schedule; a save adds a `solved` report (ignored on load, for agents reading the
file raw). History/draft/`dirty` use input-only text; the file is written
compact. Dates local wall-clock `YYYY-MM-DDTHH:mm`; calendar days `YYYY-MM-DD`
strings. Parsing strict, refuses rather than repairs, and the gate holds on
**every** path in (`validateResources` included — a parseable-but-unschedulable
file would replace the open project) **and on the way out**: `serializeForFile`
(Save, `toText()`) re-parses what it wrote and refuses rather than hand over a
file this app could not reopen — a refused save writes nothing and stays dirty.
`serializeProject` stays unguarded, or a parse would run per edit and a throw
would take undo and the draft with it. Details:
[docs/file-format.md](docs/file-format.md).

## Verification

`window.confirm` returns `false` instantly in the embedded browser — use
`ConfirmDialog`. UI is verified in the running app, never asserted from code;
read [docs/verification.md](docs/verification.md) first (print, Escape, hover,
React-controlled fields, `ResizeObserver` — what synthetic input can and cannot
prove). What a verification may claim:

- It reports what it saw, never what does not exist. The library is an actor:
  dhtmlx paints bars in `.gantt_bars_area`, not in the row, and a stylesheet is
  not the DOM. `node scripts/ab.mjs` drives the page (the `verify-ui` skill);
  its `probe` reads the grid row, the timeline row and the bar back for you.
- Measure; don't derive. A number computed at the desk is a guess.
- An inherited premise is not a verified one: verify it on the path that uses
  it, not on the line that states it.
- A conditional keeps its condition. "X, or Y would happen" is verified by
  testing Y, not by observing that X holds today.
- A copied citation is not a verified one. Re-locate it, cite by symbol.
- A census is a matrix of driven cells plus an explicit "not driven" list;
  scoping a code path out of a review does not scope out the sentence about it.

## How good is good enough

This is a small tool published as it is: its author uses it, and so may anyone
who finds the live build. It promises no accessibility audit and no pixel
contract. **On anything visual, ~80% of the achievable
precision is the target**; the last 20% needs a reason of its own, and "the
threshold exists" is not one. A change that costs a new mechanism, a modifier
class or a docs pass to move a perceptual metric by a fraction is overkill —
fix the defect a user actually sees, then stop. The *polish* tier of
the `verify-ui` skill is the same rule applied to verification itself.

**A measured floor is evidence, not a goal.** When a number and the visible
defect disagree, fix the defect; when a number and a stated preference collide,
the collision goes to the user with the numbers.

**This does not extend to correctness.** The *Invariants* above, the
day-boundary rule, effort conservation and the file format's strict gate are
absolute: they are semantics, not polish, and a wrong schedule is not 80% of a
right one. The 80% rule is about how far to push perceptual precision, never
about how much of a rule to honour.

## Documentation map — keep it current, keep it small

| File | Contents |
| --- | --- |
| `README.md` | Shop window: features, screenshots, quick start. Sells, doesn't document. |
| `docs/scheduling.md` | Engine semantics: simulation, float, availability, day boundaries. |
| `docs/view.md` | UI decisions that constrain later work: the constraint and the fact, not how it was found — that is the commit message. |
| `docs/file-format.md` | `.gantt` v2, strict parsing, CSV/PNG/print. |
| `docs/dhtmlx.md` | Library traps a code comment at the site cannot hold. |
| `docs/verification.md` | Embedded-browser quirks, verifying UI from an agent. |
| `src/gantt/agentApi.help.md` | Agent surface. **Is** `arrogantt.help()` and `/llms.txt`. |
| `CHANGELOG.md` | Releases a user cares about. Newest first; the header badge shows the top entry. |

**A commit that changes behaviour described in `docs/` updates the affected file
in the same commit.** Docs are facts, not prose: a bullet is at most three lines
and records what was decided, not how it was found. **A number belongs in a doc
only when it is the rule** (a file-format field, a working day's hours); a
measured value goes stale with the next edit and then costs a re-measurement
to keep the sentence true. Name the token or constant that holds it instead.
The proof that something was measured is the commit message, not the doc.
README changes only when the feature set changes; retake `docs/assets/`
screenshots when the UI drifts enough to misrepresent them.

**A lesson becomes a rule only if it recurred and code cannot prevent it.** A
test, an assertion, a script or a lint rule comes first; a line here or in
`docs/` is the fallback. This file is read at every session start: delete
before adding.

**Changelog.** A significant feature adds a bullet to `CHANGELOG.md` in the same
commit, under `## Unreleased`; a release is always confirmed by the user. How a
bullet is written, ordered and released: the `changelog` skill
(`.claude/skills/changelog/SKILL.md`) — read it before touching the file.

## Conventions

- **Code, comments, commits, UI: all in English.**
- Comments: the *why* only — never the *what*, never the previous state.
- One commit per completed, tested feature, docs included.
- Before committing: `npm test`, `npm run build`, `npm run lint` all clean.
- **Icons are lucide, everywhere**: `lucide-react` components in React code,
  `lucide-static` SVG strings in dhtmlx HTML templates. No hand-drawn icon SVGs.
  The critical-chain and dirty state dots (CSS pseudo-elements), the logo and
  the HelpDialog diagram are not icons and stay as they are.
