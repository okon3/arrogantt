# View decisions

The view wraps dhtmlx-gantt Community, **rendering only**; the engine doesn't
know it exists. Library traps: [dhtmlx.md](dhtmlx.md). This file records the
constraints and the facts; the reasoning is in the commit that made each.

Icons are lucide only (`lucide-react` in components, `lucide-static` strings
in dhtmlx templates), except the critical-chain/dirty CSS dots, the logo and
the HelpDialog diagram. The `→` between a period row's two dates is the word
"to" set as an arrow, not a control.

## Colour scheme

- **Light / Auto / Dark, a switch in the header** (`ThemeSwitcher`, `theme.ts`).
  Auto follows `prefers-color-scheme`. A view preference in `localStorage`
  (`arrogantt.theme.v1`), never in the file. Resolved onto `data-scheme` on the
  root; an inline script in `index.html` sets it before the first paint.
- **Every dark rule is `:where([data-scheme='dark']) …`**: no specificity
  added, so the cascade is the one the media query gave; dhtmlx's block alone
  is `html:root[data-scheme='dark']`, to outrank the vendor.
- One palette, two sets of values: dark redefines the same variables in
  `index.css`; no rule knows which scheme it is in. Accents lighten on
  emphasis in dark.
- **`--band-nonworking`** (chart bands, help diagram; painted under content)
  is derived from `--line-strong` in light and flat in dark on purpose: a
  retune of the line grey does not reach dark.
- **`--band-nonworking-over`** is the load lane's veil (painted over content):
  black at low alpha in both schemes, tuned separately.
- **Dark greys are neutral, no blue cast** (surfaces, lines, inks, inverse,
  track): a taste taken from a reference design. Accents keep their hue.
- **Task, avatar and swatch colours do not change with the scheme.**
- **`COLOR_OPTIONS` tints (`colors.ts`) are distinguished by hue and
  luminance**, every tint clearing WCAG's non-text floor against both chart
  row backgrounds. Chroma is not capped, a deliberate trade against a soberer
  set.
- **A bar's outline is a darker mix of its own fill**, not a fixed line colour
  (`--dhx-gantt-task-border`, `gantt.css`), same multiplier as `shade()` in
  `colors.ts`. It costs the bar content box ([dhtmlx.md](dhtmlx.md)).
- **The `seg-pct` badge's ink adapts to the tint** (`needsDarkInk`,
  `colors.ts`; `segmentBar.ts` emits `seg-pct--dark`), rather than capping the
  palette for one fixed ink.
- **`AVATAR_COLORS` is kept clear of the task palette** by a CIEDE2000 floor,
  not a lightness or chroma band. It is the fallback: a person with a colour
  of their own (People, the face opens the panel) wears it everywhere.
- **"Auto" in the swatch row is no colour** (`ColorSwatches`, shared by the
  task and the person): the default blue is a choice like any other and is
  stored.
- **Dark `--on-accent` is near-black, not white**: accents lighten in dark.
  Every accent-filled button reads its ink from that variable.
- dhtmlx's own dark theme is taken for the parts we don't skin, base colours
  re-pointed at the palette ([dhtmlx.md](dhtmlx.md)).
- **Paper stays light**: `planFigure` carries its own literals and
  `@media print` puts the page back to white.
- **The header (`.app__bar`) and the status bar sit on `--surface-sunken`;
  chart, grid, scale and timeline stay `--surface`.** A taste adopted, not a
  defect fixed. Controls on those bars: one register at rest → hover →
  pressed (`--line` then `--line-strong`, since `--surface-hover` regresses
  against the sunken background), and `--surface` for borderless pills that
  would otherwise vanish into it.

## Motion

- **Motion carries information or is absent**: entries (dialogs, menus, the
  dirty dot), press feedback, a refusal's shake. **Hover stays instant**:
  buttons transition `scale` alone, never their colour.
- Durations and curve only from `--motion-fast`, `--motion-base`, `--ease-out`,
  and `--motion-fold` with a critically damped spring for branch folds;
  `prefers-reduced-motion: reduce` zeroes every duration, so nothing moves.
- Entries only: dialogs and menus unmount on close, so there is no exit to time.
- **A re-solve slides the bars it moved** (`glideBars`, `motion.ts`): after
  `applySolution` and an undo/redo restore, never on a file load. `left`/`width`,
  not a transform (labels would stretch); a bar that changed row jumps.
- **A branch toggle folds like a lane** (`foldRows`, `motion.ts`): children
  slide out of the parent's row and back into it, fading; closing ones are
  inert copies, as dhtmlx drops them first. One offset per task id in both
  panes; links jump. Collapse/Expand all, search, the agent API jump.
- **Today glides; Fit, zoom and the agent's `showToday()` jump**: a zoom moves
  everything at once, and a script's screenshot must find the scroll landed.

## Zoom and timeline range

- Five zoom levels (days → quarters). Quarters are a custom scale unit.
- Ctrl+wheel and trackpad pinch zoom: app-bound `wheel` listener, one step per
  gesture burst. The date under the pointer stays under it, as far as the
  range has room to scroll; the status-bar buttons zoom about the viewport.
- **The window widens whenever the plan no longer fits.** An edit only ever
  grows it; a zoom or *Fit* recomputes it. Not per edit.
- **The widened window is pinned on the plan plus the widest task name**, so
  the room past the last bar is the app's answer, not the path's. Left to the
  data the margin is one column, and a name sliced there is unreachable at
  any scroll. Trailing space after an edit is the deliberate price.
- **Wide enough is decided in pixels, at the scale on screen**: coarser
  columns buy fewer pixels for the same pin, so a change of scale asks again.
  The widest name is measured off the stylesheet and cached against the names
  it was measured on.
- **A change of scale recomputes the window from the plan; it does not repair
  it.** Plan and level decide the window, the route there does not.
- *Fit* picks the level for the plan alone and the margin goes back on top.
  **Bars can be off screen too**: columns never render narrower than
  `min_column_width`, so a plan too wide for the window at the coarsest level
  scrolls. The limit is the library's ([dhtmlx.md](dhtmlx.md)).
- **An opened plan is collapsed and fitted at once.** Status-bar count is the
  plan's, not the screen's. Open branches are view state: nothing marks the
  file dirty.
- Every way in (toolbar, drag-drop, draft, `loadText`) shares one call; fit
  runs after the load. **Undo is not an opening**: same restore path, keeps
  viewport, zoom, closed branches.

## Grid

- **Columns are a registry (`columns.ts`), the grid a filter over it.**
  `PLAN_COLUMNS` holds metadata; `gridColumns.ts`'s `GRID_CELLS` decides each
  cell (`template`/`editor`/`align`), keyed exhaustively so a registry entry
  with no renderer is a compile error. `text`, `info`, `toggle`, `add` are
  structural and never hideable.
- **Every numeric column is `align: 'right'`; dates and the avatar stay
  `center`.** Headers remain centred: `align` does not reach the head cell in
  this build ([dhtmlx.md](dhtmlx.md)), and a rule of our own would buy no
  legibility.
- **`rate` and `cost`, `defaultShown: false`.** Their `label(project)` carries
  the currency (`Rate (EUR)`), the bare word when absent; the unit lives in the
  header, never in a cell (`format.ts` is unitless). They are the only two
  columns whose width is sized against a named string: `rate` against its
  header, `cost` against a `≥` nine-digit cell; `columns.ts` carries the
  budgets. **The two have separate budgets and separate cut-off thresholds**,
  decided by glyphs and column, not character count; a long currency label is
  cut rather than paid for in grid width. The figure's header (`figureWidth`)
  is a separate, glyph-blind budget under `truncate` in `planFigure.ts`.
  Cost cell: empty when the row's own effort is zero; `—` (`gantt-derived`),
  titled *No resource* or *No rate for `<name>` on these days*, when
  `cost_amount` is `null` (the null rule is `reportedCost` in `cost.ts`, never
  re-derived here); `≥ <amount>` titled `<n> d of effort not costed` for a
  partial sum (a rate is never negative, so it is a true lower bound). Rate
  cell: the row's `daily_rates`, one figure or an en-dash range, `—` for a leaf
  with effort and no rate, empty on summaries and milestones. Neither carries
  an `editor`.
- **Hidden means not built, never `hide: true`** (`(PRO)` in the typings,
  unprobed). A column absent from `config.columns` cannot be tabbed into,
  edited or measured.
- **The picker**: a status-bar icon opens a non-modal `<dialog>` around
  `ColumnChecklist`, one checkbox per registry entry in registry order (a rule
  shared with the Export dialog), `text` never offered. Closes on Escape and
  on a capture-phase outside click that opens no editor (`ColumnPicker.tsx`,
  same shape as `RowMenu`). Focus moves to the first checkbox on open (an
  explicit `.focus()`; `setAutofocus` only fires through `showModal()`), Tab
  cycles the checkboxes wrapping, Escape alone returns focus to the button.
  It flips **above the button**, above its top edge. *Reset to defaults*
  under the list sets the boxes to the registry's `defaultShown` (resource,
  effort, end) and is saved like any tick.
- **Dates in the grid read `8 Dec`**, the year only off the current one
  (`formatDay`, `format.ts`); the drag tooltip shares it.
- **Persisted as a preference, not plan data**: `localStorage`
  `arrogantt.columns.v1`, a JSON array of the shown names, written by a picker
  change, read once at first render (`readColumnSelection`). Anything
  malformed falls back to the defaults; unknown names are dropped silently.
  Never in the `.gantt` file.
- **View state that survives a reload**: no undo entry, no dirty flag, nothing
  in `toText()`, no `window.arrogantt` op.
- **One rebuild path, `rebuildColumns()` in `GanttChart`**, called from
  `setColumns`, `loadProject` (after `gantt.parse`), `setCurrency`, and
  `setResources` with a currency argument; never from `applySolution`. **It
  carries over every dragged width by name.** Grid open: sets
  `config.grid_width`. Grid collapsed: leaves it at 0 and writes the budget
  into `savedGridWidthRef`. `gantt.render()` makes it stick
  ([dhtmlx.md](dhtmlx.md)); the init effect builds from the selection before
  `gantt.init()`.
- Columns: inputs (name, resource, effort, start) + derived **end and
  duration**, faint italic, **no editor declared**. A summary's
  effort/resource/start are refused the same way.
- **The name cell carries a native `title` with the full name**, unconditional
  — the cell clips with an ellipsis at its own default width, and no render
  measures which rows overflow. The rich tooltip stays on the bars.
- **Summary resource column** shows up to `AVATAR_STACK_LIMIT` overlapping
  faces + `+n`; native `title` names them all. Stacked faces carry **colour
  only, no initials**, and don't highlight; `+n` is the only one with text. A
  single-person branch draws a normal avatar.
- The two derived columns are paid by the **timeline**, not the name column.
- **A click outside every task deselects**: empty timeline, a lane beside its
  bar, the grid below the last row (`onEmptyClick`, and `onTaskClick` on a
  `.gantt_task_row`).
- **A click on the name selects the row; a double click renames.** Every
  other editable cell opens on a single click. Only clicks are refused on
  `text` (`onBeforeEditStart`): Tab, Shift+Tab and scripts still open it.
- Editor keys: Tab/Shift+Tab walk editable cells across rows saving each on
  leave; Enter saves+closes; Esc closes without saving. Focused field carries
  the app's focus ring.
- **A top-level task starts a new group** (`gantt-row--group-start`,
  `installRowTemplates`), marked on grid and timeline rows both with a 1px
  inset top shadow in `--line-strong`. Not a background: hover, selected,
  found already contend for it, and zebra striping is off for the same
  reason. Not a `border-top`: a border offsets the grid pane against the
  timeline once the grid scrolls. 1px is a taste taken over legibility: in
  light `--line-strong` is one step from `--line`. **`box-shadow` does not merge
  across rules**: a further row rule drawing a shadow on a group-start row
  needs a compound declaration carrying both
  (`.gantt-found.gantt-row--group-start`), in **both** panes; in the timeline
  every top-level row is a group start, so without it the match's edge never
  paints.
- **The timeline fades out under the grid's edge** (`.timeline_cell::after`,
  `--surface` to transparent), over bars and links, pointer passing through.
  On the cell: `.gantt_task` scrolls itself and would carry it off screen.
- **Collapse to zero width, status-bar toggle** (`toggleGridCollapsed`).
  Remembers the width by measuring `$grid.offsetWidth`, not
  `config.grid_width`, defensively. Not persisted; no undo, no dirty.
- **The dhtmlx row schema is written in five places**: `toGanttData` and
  `applySolution` (plus `writeChainOntoRows`) map model → row;
  `handle.addTask` builds a new row; `onAfterTaskAdd` and `pullFromView` read
  row → model. A new field goes in **both** model → row paths wherever the row
  mirrors the model; added to one only, it is right on open and stale after
  every edit. Identity and view state (`text`, `parent`, `open`, `progress`)
  are written by the parse alone and must stay so.
- **The two model → row paths are not interchangeable**: `toGanttData` formats
  dates as strings for `gantt.parse`, `applySolution` assigns `Date`; whether
  `gantt.parse` accepts a `Date` is unverified.

## Right-click add

- Context menu on grid row, bar, or a bar's empty lane: task below, subtask
  inside, milestone below.
- **Where you click decides the start**: on the timeline, the day under the
  pointer (rounded to a working day); in the grid, the target row lends its
  start. **Never today.**
- Menu closes on Esc or outside click, and that click does nothing else. Del
  and Ctrl+Z are held off while open.
- *Close gaps* (summaries only, `closeGaps`): every leaf below with an effective
  predecessor declares the subtree's earliest declared start, so it re-solves to
  its predecessors' finish. Unlinked leaves are anchors and keep theirs.

## Details panel

- **A panel docked right of the chart** (`TaskPanel`), not a modal: opened by
  the row's (i), it shows the selected task, follows the selection and closes
  when it clears, on × or on Escape. The chart narrows; the status bar spans both.
- **Every change applies at once** through `updateTask`, one undo step each:
  text, number and date fields on leaving them (or Enter; Escape takes the edit
  back), select, colour and checkboxes on change, pace rows on leaving the
  section (a row added or removed at once). A refused value reverts and says why.
- Holds float (measured per change, bounded by `CRITICAL_CHAIN_LIMIT`),
  progress, colour, and delete (with subtree + dependency cleanup).
- Only a task **with subtasks** confirms deletion. The opener button names its
  task.
- **Auto end is the switch** (checkbox under End): on, the end is computed and
  read-only; off fixes it at the start plus the effort in working days
  (`endFromEffort`), and End becomes a date field. Back on hands the end to the
  engine with the effort the task had. Effort stays editable as the estimate. On the grid a fixed task's Effort cell is the work that went in:
  derived, so not editable. The bar's name carries a pin.
- **Dragging a fixed bar moves it whole** (`moveFixed`): same working-day
  length. **Its edges drag**, each to the working day it is left on.
  `drag_resize` is on for that alone: `onBeforeTaskDrag` refuses a resize of
  any other bar, and the stylesheet hides their handles. **Its edges show a
  grip at rest** (`.bar-grip`, drawn by `task_text` over the profile in a light
  mix of the task's colour, which lives nowhere else on the bar).
- `pullFromView` tells the two apart by the row: both ends off the solved
  dates is a move, one is an edge.
- A dependency drawn into a fixed task is kept and inert.
- **The description is a panel-only field**: a textarea last in the grid, on
  summaries as much as on leaves. It has no surface on the chart — no row
  icon, no tooltip, no column — and reaches a reader through the panel, the
  CSV and the agent API instead.
  - **The panel refuses past `DESCRIPTION_LIMIT`** rather than truncating with
    `maxLength`: the model must never hold a project `serializeForFile`
    would refuse, which would leave Save writing nothing. One constant
    (`serialization.ts`), counted in UTF-16 units on every surface that
    writes — the panel, the agent API and the parser.
  - Whitespace-only reads as empty in the panel and removes the text; the
    agent API stores what it is given, `''` and `null` apart.
- **Pace (`.taskinfo__pace`) is the task's twin of a person's availability**:
  an optional default share plus periods, on `PeriodRowList` and `PercentCell`
  as People's list is. Leaves with effort only — hidden on a summary and while
  the task is a milestone.
  - Percent in the form, fraction in the model. The default goes back **only
    if retyped**: the field shows a rounded figure, and writing it back would
    change a share nobody touched. Empty = not fixed.
  - **The rows show dates, the model holds days of the task**: `datePeriods`
    and `undatePeriods` against the plan as it stands (`taskDays`).
  - A closed day at either end of a row gives way to the working day inside
    it; a row starting before the task, or covering no working day, is refused.
  - Every write runs `parseTaskShare`, the gate the file and the agent API
    use; it refuses periods sharing a day, so an overlapped row
    (`overlapRefused`) says what will be refused, not *overridden*.
  - Row menu *Set pace from here…* (leaf with effort) opens the panel and adds
    one period on the pointed day (grid: the solved start), percent focused. A
    day outside the task, here and from *Add period*, stands for the task's
    nearest day. Label wraps to line two.
  - **A new period starts at the share the task already has there**, unrounded
    (`seedShare`): adding one moves nothing. Same function for *Add period*,
    the row menu and the bar.
- **Row heights are stable, not incidental** (`TaskPanel.tsx`, `.taskinfo__*`
  in App.css): anything matching a control's height uses
  `--dialog-control-h` on `.dialog` (`dialog.css`) and `.taskpanel`, set to the taller of the
  browser's two native control heights. The floor lives on the row-matching
  rules, not on `.dialog__control`.
  - **The "0 = milestone" hint is part of the Effort label**, one line
    whatever the field holds, so the row does not change height mid-edit.
  - **`.taskinfo__derived` carries only the semantics**; the height rule is
    the modifier `.taskinfo__derived--cell`, on spans standing in for a grid
    cell. `.taskinfo__checkbox` and `.taskinfo__amount` get the same
    `min-height`.
  - **Computed is a section under the fields**, always open: the panel has the
    room. The explanation that end and duration are derived (or what a
    milestone is) lives in it. Order above it: fields, Auto end, Colour, Pace,
    Description, Disabled.
  - **Computed (`.taskinfo__readonly`) is a fixed 3-track grid**: End ·
    Duration · Total effort / Float · Rate · Cost, so no entry drifts with its
    content. Sized against `Total effort`, an 8-character currency label, a
    `≥` cost and a `dd/mm/yyyy` date (`tabular-nums`).
    - **Rate and Cost read the same descriptors the grid cell renders**
      (`rateCellText`/`costCellText`, `costCells.ts`). The panel's milestone
      test is `project.ts`'s predicate. `currencyLabel`
      (`costCells.ts`) is the one home of the `(CUR)` form.
    - **A summary's Cost reason ignores `resourceName`**: `costCellText` takes
      a required `isSummary`, so grid and dialog say the same about a task
      that gained a child; `planFigure.ts` renders `text` only.
  - **Notes (`.taskinfo__notes`) reserve a minimum of one two-line note** and
    grow past it; the height varies task-to-task, never mid-edit. Spacing is
    the region's `gap`, not a per-note margin.
  - **The colour preview (`.taskinfo__preview`) is a fixed swatch** carrying
    `--radius-bar`, the bars' own corner;
    `margin-left: auto`; `.taskinfo__colors` wraps so a wider palette
    degrades to a second line.

## Bar tooltip

- Hover answers dates, effort vs elapsed, person and share, and (while marked)
  criticality and reason. Reports only what is already computed, never asks
  the engine. Where the marking is dashed the tooltip says it predates the
  last edit.
- Uses dhtmlx's own tooltip extension: one delegated listener, survives
  redraws and smart rendering.
- A task with share settings gets a `Pace` row (default, then each period) and
  its stretch is blamed on the fixed share, never on a part-time person.
  *Reduced proportionally* is judged per segment — below `soloRate` where a
  share is in force — so a split outside a fixed period stays plain contention.
  An unfixed task stopped by others' shares gets no wording of its own.

## Bar actions

- **Pointing at a bar shows its buttons beside its right end** (`barActions.ts`):
  details, Auto end (pin; not on a summary or a milestone), disable, delete.
  Each calls the handler the grid, the row menu and the panel already use: no
  rule of its own. In `$task_data`; hidden on a press, a redraw or leaving.

## Drag tooltip

- **While a bar is dragged, a pill over it says what the drop will write**
  (`dropDates`, `project.ts`, same rules as the drop): a scheduled task only
  `Starting <day>`, since the engine decides the rest; a fixed task both days
  and its working-day length. Day and short month (`8 Dec`), no year. Placed from the dragged dates, not the
  bar's node, which dhtmlx moves after `onTaskDrag`.

## Highlight (person)

- **Highlighting is not filtering**: their rows/bars/links keep opacity, the
  rest fades. A summary counts as theirs if anyone below is; a link if either
  end is. The selected row is not spared.
- Toolbar avatars pin; hovering an avatar borrows the highlight. Load lanes
  follow.
- Implementation: every row carries a class per person below it; highlighting
  injects **one stylesheet rule**, no redraw.

## Status bar

- The project total sits beside `N tasks`: `Cost 12,500 EUR`, or
  `Cost ≥ 12,500 EUR · 7 d not costed` for a lower bound, no suffix without
  `currency`. Shown iff `buildPlan(...).totalCost !== null`. Independent of
  the column selection.
- **One row, never two**: `white-space: nowrap` on the bar, and the cost and
  the agent note are the only items that give, by ellipsis. A label breaking
  inside its control reads as a second control; wrapping the whole bar costs
  more height than the break it avoids.

## Search

- Status-bar box: marks matches in grid and timeline, shows count; Enter
  walks (opening branches, scrolling, selecting), Shift+Enter backwards,
  wraps. Ctrl+F focuses the box; Esc empties it.
- **Marks and walks, never filters.**
- A closed summary hiding matches carries a **fainter mark**.
- **A match is a background and a 2px left edge in `--accent`, in grid and
  timeline both.** The edge carries it: the selected row shares
  `--accent-soft`, so the background alone is ambiguous. The bar cannot carry
  the mark (its outline is the critical chain's, its fill the user's).
- Case- and accent-insensitive. Marks come from a row template asking one
  query. Matches re-measured after every edit; the current match keeps its
  place while it still matches.

## Disabled tasks

- Toggled from the row menu, the details panel's *Disabled* checkbox, and a
  ban-icon grid column (stays at full opacity once off). All three go through
  `updateTask`'s `TaskPatch`.
- Drawn state is the **effective** one (`solved.disabledIds`); menu and dialog
  show the row's **own** flag.
- Bar dimmed (opacity + desaturating filter). Grid row: most cells' ink goes
  muted; End/Duration keep their fainter ink (reason in the `gantt.css`
  comment); dot, avatar and part-time badge take the bar's opacity + filter;
  the name is struck through, and the dot is a sibling span so the line does
  not cross it. Action buttons stay at full strength. Milestones share
  `task_class`.
- Never coexists with critical or shared (engine guarantee), so the three
  classes are independent.

## Bar decorations

- **Critical chain = outline, never fill.** **Off by default**; toggle in the
  status bar. Links are never drawn as the chain.
- Task names sit **beside** bars.
- **A bar's colour is chosen, then its person's, then the default**
  (`barColors`, `project.ts`; the figure follows): the colour set on the
  row's top-level task wins for the whole branch; failing that a leaf takes
  its person's, and a summary's only when every leaf under it is one person's.
- **A summary carries that colour as it is**: its thin shape sets it apart
  from its leaves, not a second shade.
- **The row carries two colours**: `bar_color` is what is painted, `own_color`
  mirrors the model and is what `pullFromView` reads back. Reading the painted
  one would turn a person's colour into a chosen one on the next edit.
- **Bar shape = `--radius-bar`**, the app's small-radius family. The summary
  takes its own smaller radius, sized to its height; the milestone diamond
  restates its own; the today scale chip stays a pill (a chip, not a bar).
- **The critical ring is rounder than the bar it marks; accepted.** An
  `outline` has no radius of its own: its silhouette is `border-radius +
  outline-offset + outline-width`, so the offset is not the lever and the
  body's radius is; shrinking it reads squared for no visible gain.
- **Milestone = diamond**: same colour, same ring, same dimming; grid dot
  becomes a diamond; dialog heading flips to *Milestone* at effort 0.
- Milestone day placement: one that closes something is drawn where that
  thing ends; one nothing runs into sits on the morning of its date. Decided
  from **predecessors**, never the start constraint.
- Today: exact vertical line at every zoom + a pill on the scale cell.

## Pace periods on the bar

- **A period never reaches past its task's end** (`trimSharePeriods`): after
  every solve in `applySolution` and `loadProject`, a `toDay` past the task's
  last working day is cut to it and a period starting after it is removed.
  - Inside the edit's own `applySolution`, before `onChange`: the cut is in
    the history step of whatever shortened the task, on every path — dialog,
    drag, grid, agent API.
  - On load it cuts the project the caller then snapshots, so a file reaching
    past an end opens clean, not dirty.
  - It writes `solved.engineTasks` too: the critical chain re-solves them.
- **A period is placed from the solved start**: `taskDays` turns its ordinals
  into calendar days; its box spans those days' columns, a weekend included.
- Double-click on a leaf's bar adds a one-day period; edges drag in whole
  days, the level grip in tenths (0 = paused); × or an edge past the other
  removes it. Summaries and milestones get nothing. No modifier key.
- **A layer over the bars (`.pace-layer`), not markup inside them**: dhtmlx
  replaces a bar's node on refresh and selection ([dhtmlx.md](dhtmlx.md)).
  `pacePeriods.ts` decides what a gesture means; `paceHandles.ts` is the DOM.
- **At rest a period shows a faint tick on each edge** and nothing else: the
  chrome comes up with `pace-period--hot`, set
  on `mousemove` over the task's timeline row (a period's body lets the
  pointer through, so `:hover` never matches), and during a drag.
- **The edge is the same tick in all three states**, inside the bar's height:
  faint, full, then the bar's own colour lit (`--pace-bar`) while dragged.
- **A bar's percent labels (`.seg-pct`) show on that same hover only**, for
  every bar, paced or not: the shell puts `gantt-bar--hot` on the hot task's
  bar and again after each redraw (dhtmlx replaces the node). Screen only.
- No readout on the period: the bar's own labels say the rate, the drag tip
  the period's dates and share.
- Below `NARROW_PX` a period's edge strips sit outside it: draggable at
  every zoom, never overlapping.
- **The grip is the period's share of the person, not the rate drawn**: on a
  part-time person the fill under a period at 100% stops short of the grip.
- **An edge snaps to working days and stops at day 0 and at the day beside
  the neighbouring period** (`moveEdge`). Nothing clamps it at the task's end:
  the preview's own solve finds the end and the trim cuts there.
- A double-click on a closed day inside the bar takes the working day nearest
  to it; outside the bar or inside a period it adds nothing.
- **A drag previews by re-solving without `onChange`** (`preview`, in
  `GanttChart`'s init effect); its release is one `updateTask` through
  `onSetPacePeriods`, like the dialog's Save.
- **Every move starts from every task's list at the press** (`atPress`), the
  trim applied to the preview only: a level raised and lowered again in one
  drag gives back what it cut, on the dragged task and on its neighbours.
- The release keeps the model's lists — the trimmed ones. Escape, or a release
  where the drag began, puts every list back. Every key is swallowed mid-drag.
- **Periods of one task do not overlap**, on every path in (`parseTaskShare`).

## Dependencies

- **Links recede at rest in dark** (`--link-rest`) and come forward in
  `--accent` under the pointer, as do those of the task pointed at
  (`linkHover.ts`, a stylesheet rule keyed on `link_id`: a class would not
  survive a redraw). In light the line grey is left as it is.
- **A selected task keeps its links forward, in `--accent`; every other link
  dims to `--gantt-dimmed`** (`linkHover.ts`, a second rule). No selection:
  all at rest. The pointer still raises any link over the dimming.
- **A link pointed at offers a × on the middle of its longest stretch** that
  removes it at once, no question: undo is the way back. It does not follow
  the pointer. Double-click and its vendor confirm stay.
- **A link with an end inside a closed branch draws no arrow; the bar carries
  a small one instead** (`hiddenLinks.ts`): on its left for what it waits
  for, on its right for what follows, through `leftside_text` and
  `rightside_text`. A closed branch carries those of everything inside it
  that reach outside. The bar tooltip names the tasks.
- **Pointing at a row draws its hidden links onto the closed branch's bar**
  (`rolledLinks.ts`), dashed, in the accent, for that row only. A pair of
  rows linked both ways gets one line with a head on each end. A layer of our
  own in `$task_data`, never links added to dhtmlx, which `syncLinks` would
  read back as dependencies.
- **Two forms were tried and refused by the user** (2026-11-21): all those
  lines drawn at rest (too noisy, and a task before and after one branch read
  as a contradiction), and a count beside the bar (a bare number said
  nothing). Do not re-propose either.
- **A summary's side content no longer clips** (`overflow: visible`): its
  box is the bar's height, enough for the uppercase name, not for the count.
- **A label is lifted only over an arrow that is drawn**: `gantt-bar--no-arrow`
  (`task_class`) levels it when no outgoing link has a visible target.
- The link handle sits above the task label (`.gantt_link_control
  { z-index: 3 }`, `gantt.css`): the label used to cover the dot.
- Only finish-to-start links: a left-handle drag is rejected in
  `onBeforeLinkAdd` with a message. `syncLinks` reads every link as FS.
- The error banner (`.app__error`, `App.tsx`) clears on the next successful
  model change (reset in the `onChange` funnel), not on a timeout. Absolutely
  positioned inside `.app__body`, so it never shifts rows under a mid-gesture
  pointer.

## Non-working time shading

- Two registers: **non-working days** grey (calendar-driven); **time off**
  red, shutdown on every row, absence on that person's rows. Only zero periods
  count as time off.
- Time off has tokens of its own (`--band-timeoff`, `--band-timeoff-hatch`),
  the danger pair in light and a quieter mix of it in dark.
- Bands positioned in **pixels**, exact at every zoom. Time off paints twice:
  tint under bars + hatch over them.
- Only non-working days can be dropped, by **width** (below the hairline
  threshold), not zoom level. Time off has no floor.
- Width test = one pixels-per-day for the whole timeline × run length; never
  the band's own width (month columns vary). Runs measured before clipping to
  the rendered range.
- Allocation profile = single SVG path inside the bar. Both it and the bands
  place own elements in the data area. **Its corners are rounded**
  (`STEP_RADIUS_PX`, `segmentBar.ts`): the radius is taken in pixels, per axis,
  since the viewBox stretches unevenly, and capped at half a short edge.
- `drawsProfile` decides profile vs plain fill, once, where the row is written;
  the bar template reads the row's `shared` flag. A gap between segments calls
  for the profile **only on a task carrying share settings** (its pause reads
  as empty track); a full-rate bar across its person's absence stays plain.
  A wait before the first segment always does: the bar opens on the anchor.

## Resource load lanes (*Resource load*)

- One lane per person under the chart, same time axis. **Over-allocation
  cannot happen**; the signal is **unclaimed capacity**: dashed ceiling =
  capacity, solid band = booked, gap = the answer.
- Lanes tile the plan; everyone gets one. Label: days booked + days free.
  Hovering a lane names tasks and rates; hovering the avatar borrows the
  highlight.
- **A summary contributes nothing; an unassigned task appears in no lane.**
- Aggregation is the engine's (`load.ts`), from the same allocation segments
  the bars draw; capacity from what the simulation granted, not re-resolved.
- X positions from `posFromDate`, following the scroll; the lane starts at the
  timeline's measured origin, not the grid's width ([dhtmlx.md](dhtmlx.md)).
  Weekends shaded with the same runs and threshold, in
  `--band-nonworking-over` **over the plot**.
- **`.loadlane__label` carries no padding or border**, so it renders at any
  width `toggleGridCollapsed` drives it to, including 0: a flex item's
  implicit `min-width: auto` and a `border-box` element's padding were two
  separate floors. Spacing is `margin` on its first/last child; the divider is
  an inset `box-shadow`.

## In-app help

- Reached from `?` and from the empty state. Explains the rising/falling fill
  and why critical-with-float isn't a contradiction.
- Diagram **drawn, not screenshotted**: SVG using `segmentBar.ts` geometry and
  `gantt.css` colours.
- Empty state is minimal (name, one line, two buttons, help link).
- Header version badge: the top `CHANGELOG.md` entry, opens the changelog
  dialog. Last seen version in `localStorage` (`arrogantt.seenVersion`); a
  new top entry opens the dialog once; a first visit records silently. Waits
  for the unsaved-draft question first.

## Dialogs

- `Dialog` (`Dialog.tsx`) owns the `<dialog>` chrome for every modal:
  `showModal`, the focus/scroll fallback, header/body/footer. Mounted only
  while open; never takes an `open` prop.
- **`.dialog__body` is the only scroll container.** Header, error slot and
  footer are `flex: none`.
- **Width is fixed per dialog, never content-driven**: no `min-width` in a
  dialog rule. Height is content-driven up to a cap.
- No header close button. Esc and the footer button dismiss through
  `onDismiss`, latched once per mount (a real Escape fires `cancel` then
  `close`).
- **Focus on open rests on the safe option, not the one that acts.**
  `ConfirmDialog`'s Cancel carries a literal `autofocus` attribute via
  `setAutofocus` (`autofocus.ts`; its own module for Fast Refresh). React's
  `autoFocus` prop cannot supply this: it focuses at mount, while the dialog
  is still closed. **`ExportDialog` is
  the one deviation**: an export is neither destructive nor irreversible, so
  its confirm button carries it and Enter exports.
- CSS: `src/dialog.css`, imported before `App.css`, so an equal-specificity
  per-dialog override wins by source order. Every `.dialog__*` primitive is
  reached by an explicit class on its own element, never a descendant
  selector. The backdrop's dark alpha lives beside the light one in that file.
- **`.dialog` states the base font size**; `.dialog__control` and
  `.dialog__btn` are `font: inherit`. Deliberate steps off it stay explicit.
- **A descendant rule outranks a primitive**: `.block__row button` beats
  `.dialog__btn` whatever the order. No dialog control is styled that way;
  give it an explicit class. Grep for what else selects a control before
  assuming its class styles it.
- **Period-row lists (`.ranges__row`: shutdowns, availability, rate periods)
  share one CSS grid template**, in `PeriodRowList`, with a `--pct` modifier
  for the value track; `AvailabilityList` and `RatePeriodList` are thin
  wrappers, so the two lists in People's panel share tracks by construction.
  Count is `nowrap`. **The label is the only `1fr` track.** A field's unit
  sits inside the field (`.dialog__field`/`.dialog__suffix`); the rate row is
  the exception, its currency declared once for the dialog.
- **A period-row a later row overlaps says so on a line under it**
  (`coverageByLaterRanges`, last declared wins): passive, never refused or
  reordered; days counted as working days. A task's pace list refuses instead.
- **The People table (`.people__table`) is `table-layout: fixed` with a
  `<colgroup>`**, tracks sized against header and widest content. The
  expanded panel (`.people__offPanel`) spans the table's content box and hosts
  both period lists under their own `.dialog__subhead`s.
- **The People dialog's `Currency` field sits above the table, on its own
  line** (`.people__currency`), and reaches `setResources` as its third
  argument so one Save is one undo step. **The dialog trims; the parser and
  the API do not.** `validateCurrency` (`cost.ts`) runs on the trimmed label.
- **`.dialog__subhead` is the one grammar for a section subhead**; one that
  opens a body or a padded panel adds `.dialog__subhead--flush`.
- **`.dialog__hint` caps its measure at `58ch`**; a hint that is the dialog's
  whole prose adds `.dialog__hint--wide`.
- **`Dialog` takes an optional `bodyClassName`**, the sanctioned per-dialog
  body override (ties specificity, wins by order). `ConfirmDialog`'s
  `.confirm__body` is the case in hand.

## Export dialog

One dialog (`ExportDialog.tsx`) on both the PNG and the Print button; `action`
decides the title and the confirm label. CSV starts at the click: nothing to
ask.

- **Three questions, and no fourth**: Rows (*The whole plan* / *As I see it*,
  passed as `collapsedIds`), Columns (`ColumnChecklist`), and *Leave out
  disabled tasks* (a row filter, not a scope). **Dates always span the whole
  plan** (`options.slice` selects rows, never dates).
- **The preset is a button, never a mode.** *For the client* empties the
  column selection and checks *Leave out disabled tasks*; it **leaves the
  scope where it is**.
- **The default is continuity, and `resolveExportSettings`
  (`exportSettings.ts`) is its only home**: nothing stored → the whole plan
  and the grid's live selection. The component drafts at mount from what it
  is handed.
- **One checkbox list, two clients** (`ColumnChecklist.tsx`); generalising
  `ColumnPicker` would have carried its popover behaviour into a modal.
- **A confirmed print waits one render; a confirmed PNG does not.**
  `window.print()` blocks, so the request goes into state and an effect makes
  the call. Why that effect also writes the ref `installPrintFigure` reads is
  in the comment there, and only there.
- **Ctrl+P opens nothing** and prints with the settings as they stand:
  `installPrintFigure` hangs off `beforeprint`.
- **Its own `localStorage` key** (`arrogantt.export.v1`), written only by a
  confirm, read once at first render; once it exists it wins over the grid's.

## The chart's model is the caller's object until a file replaces it

`<GanttChart project={initialProject}>` hands over a module-level constant
(`App.tsx`) kept by reference (`projectRef = useRef(project)`). Until
`loadProject` reassigns it (open, *New*, resuming a draft), the live model
**is** that constant. So a throw from `solve()` costs differently: on a
virgin session a throw in the render body took the tree down (hence `solve`
at mount is lazy); after a load the same bad model throws only inside a dhtmlx
handler, where nothing catches it and the chart silently stops taking edits.
Measure a model-level failure on **both** kinds of session.

## Undo and the draft

- Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y + toolbar arrows, each naming its step.
  Inactive while a field or dialog holds focus.
- A step is a **whole-project snapshot**, restored through the file path; the
  chart reports every change through one callback and the snapshot is taken
  there.
- Open/new **clears history**. Restore keeps zoom, scroll, selection.
  *Unsaved* = diff against last-saved text.
- **Draft**: written to `localStorage` shortly after the plan stops changing;
  a reload **asks** before taking it back. Only the current project, never
  the history. A refused write drops the stored draft. Cleared on save and new
  project; while dirty, `beforeunload` guards a reload.
