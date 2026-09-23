# View decisions

The view wraps dhtmlx-gantt Community, **rendering only**; the engine doesn't
know it exists. Library traps: [dhtmlx.md](dhtmlx.md). This file records the
constraints and the facts; the reasoning is in the commit that made each.

Icons are lucide only (`lucide-react` in components, `lucide-static` strings
in dhtmlx templates), except the critical-chain/dirty CSS dots, the logo and
the HelpDialog diagram. The `→` between a period row's two dates is the word
"to" set as an arrow, not a control.

## Colour scheme

- **Follows the system, with no switch of its own** (`prefers-color-scheme`).
- One palette, two sets of values: dark redefines the same variables in
  `index.css`; no rule knows which scheme it is in. Accents lighten on
  emphasis in dark.
- **`--band-nonworking`** (chart bands, help diagram; painted under content)
  is derived from `--line-strong` in light and flat in dark on purpose: a
  retune of the line grey does not reach dark.
- **`--band-nonworking-over`** is the load lane's veil (painted over content):
  black at low alpha in both schemes, tuned separately.
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
  not a lightness or chroma band.
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

## Zoom and timeline range

- Five zoom levels (days → quarters). Quarters are a custom scale unit.
- Ctrl+wheel and trackpad pinch zoom: app-bound `wheel` listener, one step per
  gesture burst.
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
  It flips **above the button**, above its top edge.
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
- **Summary resource column** shows up to `AVATAR_STACK_LIMIT` overlapping
  faces + `+n`; native `title` names them all. Stacked faces carry **colour
  only, no initials**, and don't highlight; `+n` is the only one with text. A
  single-person branch draws a normal avatar.
- The two derived columns are paid by the **timeline**, not the name column.
- Editor keys: Tab/Shift+Tab walk editable cells across rows saving each on
  leave; Enter saves+closes; Esc closes without saving. Focused field carries
  the app's focus ring.
- **A top-level task starts a new group** (`gantt-row--group-start`,
  `installRowTemplates`), marked on grid and timeline rows both with a 2px
  inset top shadow in `--line-strong`. Not a background: hover, selected,
  found already contend for it, and zebra striping is off for the same
  reason. Not a `border-top`: a border offsets the grid pane against the
  timeline once the grid scrolls. 2px, not 1px: `--line-strong` is one step
  from `--line`, and at 1px the two read alike. **`box-shadow` does not merge
  across rules**: a further row rule drawing a shadow on a group-start row
  needs a compound declaration carrying both
  (`.gantt-found.gantt-row--group-start`), in **both** panes; in the timeline
  every top-level row is a group start, so without it the match's edge never
  paints.
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

## Details dialog

- Holds float (measured per row on open), progress, colour, and delete (with
  subtree + dependency cleanup).
- Only a task **with subtasks** confirms deletion. The opener button names its
  task.
- **Row heights are stable, not incidental** (`TaskDialog.tsx`, `.taskinfo__*`
  in App.css): anything matching a control's height uses
  `--dialog-control-h` on `.dialog` (`dialog.css`), set to the taller of the
  browser's two native control heights. The floor lives on the row-matching
  rules, not on `.dialog__control`.
  - **The "0 = milestone" hint is always rendered**, hidden with
    `visibility: hidden` (`.taskinfo__hint--reserved`), so the row does not
    shrink mid-edit.
  - **`.taskinfo__derived` carries only the semantics**; the height rule is
    the modifier `.taskinfo__derived--cell`, on spans standing in for a grid
    cell. `.taskinfo__checkbox` and `.taskinfo__amount` get the same
    `min-height`.
  - **The intro hint reserves a min-height** for its normal/milestone swap.
  - **Computed (`.taskinfo__readonly`) is a fixed 3-track grid**: End ·
    Duration · Total effort / Float · Rate · Cost, so no entry drifts with its
    content. Sized against `Total effort`, an 8-character currency label, a
    `≥` cost and a `dd/mm/yyyy` date (`tabular-nums`).
    - **Rate and Cost read the same descriptors the grid cell renders**
      (`rateCellText`/`costCellText`, `costCells.ts`). The dialog's milestone
      test is `project.ts`'s predicate, not the dialog's own `isMilestone`
      (which reads the field being typed, on purpose). `currencyLabel`
      (`costCells.ts`) is the one home of the `(CUR)` form.
    - **A summary's Cost reason ignores `resourceName`**: `costCellText` takes
      a required `isSummary`, so grid and dialog say the same about a task
      that gained a child; `planFigure.ts` renders `text` only.
  - **Notes (`.taskinfo__notes`) reserve a minimum of one two-line note** and
    grow past it; the height varies task-to-task, never mid-edit. Spacing is
    the region's `gap`, not a per-note margin.
  - **The colour preview (`.taskinfo__preview`) is a fixed pill**,
    `margin-left: auto`; `.taskinfo__colors` wraps so a wider palette
    degrades to a second line.

## Bar tooltip

- Hover answers dates, effort vs elapsed, person and share, and (while marked)
  criticality and reason. Reports only what is already computed, never asks
  the engine. Where the marking is dashed the tooltip says it predates the
  last edit.
- Uses dhtmlx's own tooltip extension: one delegated listener, survives
  redraws and smart rendering.

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

- Toggled from the row menu, the details dialog's *Disabled* checkbox, and a
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

## Dependencies

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
- Bands positioned in **pixels**, exact at every zoom. Time off paints twice:
  tint under bars + hatch over them.
- Only non-working days can be dropped, by **width** (below the hairline
  threshold), not zoom level. Time off has no floor.
- Width test = one pixels-per-day for the whole timeline × run length; never
  the band's own width (month columns vary). Runs measured before clipping to
  the rendered range.
- Allocation profile = single SVG path inside the bar. Both it and the bands
  place own elements in the data area.

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
  is still closed. TaskDialog's name field uses the same. **`ExportDialog` is
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
