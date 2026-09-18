# File format and exports

## `.gantt` (JSON, version 2)

- **Inputs alone decide the schedule** — computed dates are recomputed on load,
  so a file can never contradict its own premises.
- Dates: local wall-clock `YYYY-MM-DDTHH:mm` (`toISOString` would shift an 08:00
  start to the previous day). Calendar days (holidays, override bounds):
  `YYYY-MM-DD` strings, never `Date`s (a `Date` carries time+zone that can push
  a holiday onto the neighbouring day).
- A save also writes the solved schedule as a **report**: `solved` per task
  (start, end, effort, elapsed, contention, cost, uncosted days, daily rates)
  and per project (`projectStart`, `projectEnd`, `solvedAt`, `totalCost`,
  `uncostedDays`). No `currency` in the project block — the root `currency`
  key (below) is where that fact lives. Same solve as the inputs beside it,
  **ignored entirely on load** — it exists for an agent reading the file
  without the app (`start` = what was asked, report = where it landed,
  `solvedAt` = snapshot date).
- Undo history, draft and the `dirty` comparison use the **input-only**
  serialization (a report in a snapshot is noise; `dirty` would compare
  mismatched shapes). The file is written compact (no indentation) — agents
  parse it, pretty-printing only pads it.
- A row with children is written **without `resourceId`** (the engine ignores a
  summary's, but nothing in the file would say the field is inert).
- **Task list order = row order**, written back on reorder (the list was always
  read in written order).
- `disabled: true` marks placeholder work (semantics:
  [scheduling.md](scheduling.md)). Optional and additive — v2 stays v2. Written
  only where it is set: the flag is inherited by the subtree, so a child under a
  disabled group carries nothing of its own.
- Version 1 still loads: `daysOff` → availability overrides at zero.
- `resources[].availability?: number`: a person's share of a full working day,
  `0..1`. Optional, default `1` (full time). Written only when present: a
  save never adds the key to a resource whose file had none.
- `resources[].dailyRate?: number` and `resources[].rateOverrides?:
  [{ from, to, dailyRate, label? }]`: a person's default daily rate and the
  periods that replace it (last declared wins on overlap, the mirror of
  `availabilityOverrides`). Optional and additive — v2 stays v2. Written only
  when present: an absent `dailyRate` means the rate is unknown, never `0`; an
  empty override list is omitted rather than stored. `0` is a valid rate and is
  written. An override with no default rate is allowed — the rate is unknown
  outside it, known inside.
- Root `currency?: string`: a free label shown beside money (`EUR`, `€`,
  `k€`); the app never interprets it — nothing converts, nothing formats by
  locale. Optional and additive — v2 stays v2. Written only when present.
  A project created by **New** declares `€` (`emptyProject`), which is a
  property of the new project and not of the parser: a file opened without a
  `currency` never gains one.

## Strict parsing

Refuses rather than repairs: unknown resources, duplicate ids, dangling
predecessors, circular hierarchy, availability outside 0..1, colour not
`#rrggbb`, `disabled` not a boolean, a calendar the engine cannot serve, future
versions, a negative or non-numeric daily rate, a rate period with no numeric
`dailyRate`, a rate period with a malformed `YYYY-MM-DD` day, a `currency` that
is blank, padded, not a string, or over 8 characters. Parse before load — a bad
file leaves the open project untouched.

A written `disabled: false` is accepted and **normalized to absent**: two
spellings of the default would make one project serialize two ways, and `dirty`
compares text.

**A gap in strictness is not a bad error message, it is the open project.**
`loadProject` writes onto `projectRef` and *then* solves: a file that parses but
can't be scheduled (last case: a person left at zero capacity) throws `Scheduler
stalled` with the model already replaced — stale grid, edits dying on unknown
tasks, next save overwriting the user's work. Hence `validateResources` and
`validateCalendar` run on **every** path in: load, dialog, agent API.

**The gate also holds on the way out: what the app writes, the app can reopen.**
`serializeForFile` (Save, `toText()`) re-parses the text it just produced with
`deserializeProject` and propagates that error untouched — a round trip, not a
second validator, which would drift from the parser as the format grows. Refuses
rather than repairs here too: no sanitised copy is written in place of the
project that failed. A refused save downloads nothing and does **not** mark the
project saved (`dirty` stays on); the error line reads `Refusing to save a file
that cannot be reopened: <parser message>`. `serializeProject` stays unguarded —
it also writes the history snapshot and the draft on every change, where a parse
per edit is waste and a throw would take undo and the autosave with it.

`validateCalendar` (`calendarRules.ts`): `workingDays` non-empty, distinct
weekday indices `0..6`; `windows` non-empty, `{from, to}` in **whole minutes
from midnight**, `0 <= from < to <= 1440`, and **never overlapping**
(`minutesPerDay` is a plain sum — an overlap inflates every day's capacity and
the schedule stops conserving effort); holidays `YYYY-MM-DD` at both ends.
Declaration order is free (the calendar sorts). A missing `calendar` is the
default, a `null` one is refused. `WorkingCalendar` itself guards only the empty
week and the empty day: clock strings (`"08:00"`) reach `minutesPerDay` as `NaN`
and stall the simulation, and a weekday index outside `0..6` leaves the walk to
the first working day running forever — a hung tab, not an exception.

## CSV export

`.gantt` is the project; **CSV is the schedule** — one row per task in grid
order with the derived dates/durations the project file deliberately omits. No
CSV import (results are not premises).

Dialect for the target spreadsheet locale: `;` separator, decimal comma, CRLF,
UTF-8 BOM, dates `DD/MM/YYYY HH:mm`. `Level` = outline depth; `Summary` marks
summaries (their figures are the children's rollup — summing a column without
the flag double-counts); `Contended` = stretched by sharing, vs
part-time/absence; `Disabled` marks a placeholder the numeric columns would
otherwise sum in as committed work. Dates come from the schedule's own `Date`s, never re-converted
from working minutes (milestone lands on its diamond's instant).

`Cost` and `Uncosted (d)` are appended after `Disabled`, the last two columns
so a sheet built on the earlier order still reads. `Cost` carries the
`currency` label in its header (`Cost (EUR)`, plain `Cost` with none); the
cell itself is a bare number, empty when nothing priced the row (no resource,
or a person with no rate on those days). Empty is not `0`: a `0` is a row that
*was* priced — a milestone, with no effort to leave out, or a rate declared at
`0`. `Uncosted (d)` always writes its person-days, `0` included. Both figures
use the same decimal comma as the other columns and **no grouping** (a grouped
figure is a text cell). A summary's `Cost` sums only its priced children, so
beside a non-zero `Uncosted (d)` it is a lower bound.

## PNG and print

- `PNG` **draws** the plan (outline, people, calendar axis, every bar) rather
  than capturing the chart: only in-view rows are in the DOM and the data area
  is a viewport. The figure grows with the plan, shades weekends/shutdowns,
  marks today, keeps summary shading and milestone diamonds.
- `Stampa` / Ctrl+P prints that figure: A4 landscape, 24 rows per page, title
  and axis repeated, one shared time scale (browsers won't break an image across
  pages — unpaged = cropped). *Save as PDF* in the print dialog **is** the PDF
  export.
- The figure takes a `columns` list (`FigureOptions.columns`, drawn as a
  header band above the month band); the app passes none yet.
