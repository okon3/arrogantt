# Orchestrate binding — gantt

Project facts for the orchestrate-v2 protocol. The skill defines the process;
this file binds it to this repo. The incidents behind every rule below are in
git history (`8ff3a72` and earlier); the rules stand on their own.

- **Checks**: `npm test`, `npm run build`, `npm run lint` — all three before
  every commit, hub or lane. `node` is not on the Bash tool's PATH: run npm
  through the PowerShell tool.

- **Three tiers, by blast radius.** The tier decides the ritual, not the
  task's size, and it is about what the diff touches, never what the task
  was called.
  - *Engine*: `src/scheduler/`, the file format, anything under CLAUDE.md
    _Invariants_ or _Day-boundary rule_. Brief file, `implementer-deep`,
    critic at its default model, tests that bite (mutation-checked).
  - *Feature*: new user-visible behaviour in `src/gantt/`. Brief file,
    `implementer`, critic on `sonnet`, fixture and accept cells in the brief.
  - *Polish*: CSS, copy, layout, icon or token changes with no new
    behaviour. **No brief file, no lane, no critic.** The hub implements,
    or one session does a whole batch. Verification is CLAUDE.md's 80% rule
    applied to verification itself: computed style of the cell changed,
    before and after; one screenshot pair in light; dark only where the
    change touches a token that differs by scheme. No matrices, no
    counterfactuals, no measured rejected variants. Docs updated only where
    a sentence became false. The plan gets one line and a sha. If a premise
    fails in the browser, skip and note it in one line; do not investigate
    (K6). A polish commit is undone by one `git revert`; that is the risk
    budget the ritual is sized to. A batch that crosses into behaviour (a
    handler, a model field, a new op) stops and is re-tiered.

- **Verification doctrine**: `docs/verification.md` — user-visible behaviour
  is verified in the running app, never asserted from code. Restart the dev
  server after structural CSS changes or `npm install` before trusting any
  negative verdict (stale HMR). The stylesheet is not the DOM: dhtmlx paints
  bars in `.gantt_bars_area`, not in the row.

- **Serial constraints, and the port is the mutex**: one shared Browser
  pane, one driver at a time. `strictPort` on 5173 means two actors
  restarting the dev server kill each other's listener and fixtures with no
  error. Check the port itself (`Get-NetTCPConnection -LocalPort 5173`), not
  the lane's status: a lane `ListAgents` calls `completed` can still own the
  listener through the server it spawned.

- **Goal & plan**: `PLAN.md` at the repo root; the goal is its `## Goal`
  section. Goal-review bar = that section plus the Accept lines of the goal's
  tasks.
  **A visual goal opens from a defect the user points at, never from an
  adjective.** "More professional" or "crisper" is not a goal statement: the
  first step is the user marking at most three things on a screenshot, and
  those three are the tasks. No architect census, no reference study, no
  finding the user did not see (Goal K: a 312k census bought twelve findings,
  two of which then cost a hub generation each to establish whether they
  existed). A goal that does not fit one session is two goals.

- **The plan is a ledger, not a journal.** A task entry is at most eight
  lines: title, what, accept, the constraints the user set (bold, verbatim),
  status, sha. Reasoning lives in the commit message; a durable fact lives in
  `docs/` or here; neither lives in the plan. The plan is updated in the same
  commit as the code for engine and feature tasks, in one commit per batch
  for polish. No `Record` or `Prune` commits: a plan that needs pruning was
  written as a journal. `## Log` is one table, one row per closed task or
  batch — tier, tokens, `src/` lines, rounds — and nothing else. **Over
  ~300k tokens for under ~50 lines of `src/` is a process defect**: it goes
  to the user as such, not as a success with zero rounds.

- **Closure ritual**: on `ship`, propose the release — rename CHANGELOG.md's
  `## Unreleased` heading to `## v<next-minor> — <today>`; the user always
  confirms before the rename.

- **Git is the archive for the plan and the binding, and for nothing else
  under `.claude`.** `PLAN.md` and this file are tracked; briefs, specs and
  the lock are ignored on purpose, so a pruned plan is recoverable with
  `git show`. **Never prune a done task's Accept lines before that goal's
  review has run** — they are half the review bar; done tasks collapse to
  one line after `ship`. Tracking `settings.local.json` or `.claude/specs/`
  was proposed and refused (2026-09-09): closed, do not re-propose. A spec
  listed under _Analisi in giacenza_ is decision material and survives the
  orphan sweep.

- **No hook fires here.** `.claude/hooks/` is empty and `settings.local.json`
  declares none: no `deny-agent-commit`, no `require-brief`, no lock
  heartbeat. "Read-only" restricts Write/Edit, not Bash; a read-only agent
  has committed through Bash and said nothing, and a sister session of the
  user has committed `PLAN.md` without the lock. Detect, don't assume: read
  `git log` at every checkpoint and compare against the commits you made.

- **The lock is hand-written and its shape is load-bearing**:
  `{"session":"<id>","at":"<UTC ISO>"}` in `.claude/orchestrator.lock`,
  `at` from a real clock (`date -u +%Y-%m-%dT%H:%M:%SZ`), refreshed at every
  checkpoint; the successor compares it against a 45-minute window. Delete
  it when the session ends.

- **A completion notification is not a completion**, for lanes and for the
  hub: the same agent can notify again and resume. Never end a turn
  announcing the next step — do it, or say in one paragraph what blocks you.

- **Verify a spawn with `ListAgents`, always**, and write **"do not
  delegate"** into every lane prompt: the Agent tool reports success for a
  lane that never started, and a lane can re-spawn a deeper lane with a
  second-hand brief and no channel back to the hub.

- **Small measurements are the hub's** — a throwaway vitest probe, a
  non-resident Explore, a browser census — where a lane pays ~40k to enter.
  **Measure the premise before briefing**: if it falls, no brief is needed
  (K14 died that way at zero delegations). **One measurer per question**: if
  the hub drove the cells, the critic is not briefed to drive them again.

- **A brief that carries its fixture and its accept cells buys zero
  correction rounds** (G, H, I1, K11, K12). **It states the objective and
  the cells, not the mechanism**: on K4 and K9 two mechanisms written into
  the entry did not hold (the vendor hardcodes the `add` column template;
  `inherit` on a head cell inherits from a container that carries the wrong
  font) while the objective did. An enumerated list copied from a spec is
  complete or it is not a list. **A table cell in a brief is code the lane
  writes literally**: copy the strictest predicate, not the shape of a
  neighbouring rule, and ask why the neighbour can afford to be weaker (F1:
  a `NaN`-tolerant rate gate let `Infinity` through to `JSON.stringify`).

- **Briefing the critic**: questions in order of fear; no "both hands"; if
  tests are the stake, ask "do these tests bite?" and have it mutate the code
  in a throwaway worktree; read the reasons, not only the rules; **for every
  reason, make it state the counterfactual it tested and how** — measuring
  that the consequent holds today is not testing the conditional (K11). Give
  it the lane's not-driven list and buy it: K3 and K12 hid their defect there.

- **Briefing the goal review**: say that a third `fix-first` is not free, or
  it renders COHERENCE instead of ACTIONS.

- **Docs duty**: a commit changing behaviour described in `docs/` updates the
  affected file in the same commit (map in CLAUDE.md); significant features
  add a CHANGELOG bullet under `## Unreleased` in the same commit. **Prose is
  what lags**: check the diff against `docs/`, README and comments by
  grepping the notions touched, not from memory — and one notion can carry
  two names (`clientSafe`, `client-safety`).
