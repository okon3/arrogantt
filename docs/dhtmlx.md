# dhtmlx-gantt traps

Community build (MIT). Read before touching `src/gantt` code that talks to the
library. Each bullet is a constraint or a fact; how it was found is in git.

## Licence boundary

- **Typings don't distinguish Community from PRO**: `addTaskLayer` compiles and
  doesn't exist at runtime.
- **`plugins()` answers in silence** for a missing extension: no throw, no
  warning. Probe: `plugins({x: true})` then read `gantt.ext`. On 10.0.2
  present: `tooltip`, `keyboard_navigation`, `quick_info`, `drag_timeline`,
  `fullscreen`, `export_api`. Absent: `click_drag`, `marker`, `undo`,
  `multiselect`, `grouping`, `overlay`, `auto_scheduling`, `critical_path`.
- **A config flag does not register an extension, but it is not inert
  either**: `config.keyboard_navigation = true` without the plugin leaves
  `gantt.ext.keyboardNavigation` absent, yet core code still branches on the
  flag (smart rendering force-adds the selected row). Don't set it as a probe.
- **`inlineEditors` carries its own keyboard handling**, live without
  `keyboard_navigation`: Tab, Enter, Escape and arrows on a real `keyCode`,
  honouring `event.defaultPrevented`. The app's `editorKeys` binds Tab and
  Enter only and reads that flag, so it acts exactly on the keystrokes the
  vendor leaves alone; without the guard a real Tab moves two cells. The app
  binds `inlineEditors.editNextCell/editPrevCell` itself instead of loading a
  mode that would claim arrows and Del, which App owns. Census:
  [verification.md](verification.md).
- **One gantt instance per app** (no `getGanttInstance()` in Community).
- **Never `gantt.destructor()`** in cleanup: it kills the singleton and a
  StrictMode remount re-inits a dead instance. Use `clearAll()`.

## Styling

- **Bar colours = CSS custom properties** (`--dhx-gantt-task-background`), set
  inline per task. A stylesheet `background` silently beats a task's colour.
  Set the default by declaring the variable in a rule; inline still wins.
- **`--dhx-gantt-task-border` is a whole `border` shorthand**, in the same rule
  as `box-sizing: border-box`. A bare colour paints nothing while `borderColor`
  still reports it. Once it paints it eats the content box, so anything sized
  against the bar's inner height moves. `.gantt_milestone{border:none}`
  outranks the variable, so a milestone never gets a ring this way.
- **A CSS rule beats an SVG presentation attribute**: the allocation profile's
  colour is an inline `style` on the path, not a `fill` attribute.
- **A vendor rule can split into branches of unequal specificity, so a fix
  lands on half the rows.** `.gantt_selected` ships as a plain branch and an
  `.odd` branch one step stronger, in grid and timeline. Beat only the plain
  branch and odd rows still obey the vendor; tie and bundling order decides.
  Hover does not split (both branches read one variable). **Grep the branch
  you are overriding before choosing between a variable re-point and a rule,
  and drive an odd and an even row.**
- **A `.gantt-host`-qualified rule is how this project outranks the vendor**
  rather than tying: a tie is resolved by Vite's bundling order, which no rule
  controls.
- **The milestone bar element is `visibility: hidden`**: what paints is
  `.gantt_task_content` rotated 45°. Decoration goes on the content; an outline
  on the line paints nothing. Content inherits the line's `border-radius`, so
  restate it or the bar radius rounds the diamond into a blob.
  `.gantt_milestone` repoints the background variable at dhtmlx violet at the
  app default's specificity, hence the default is restated on both classes.
- **The built-in dark theme is an attribute, not a media query**:
  `:root[data-gantt-theme=dark]` re-points the `--dhx-gantt-base-colors-*`
  set. `theme.ts` sets it from `prefers-color-scheme`; `gantt.css` re-points
  those base colours at the palette. A bare `:root[data-gantt-theme=dark]` of
  ours only ties with dhtmlx's (`html:root[…]` outranks it), and keying on the
  attribute alone would leave the chart light if a `change` event went
  missing, hence the media query beside it.
- **dhtmlx writes that attribute back on a poll**: `setSkin` sets
  `data-gantt-theme`, and an interval reads `--dhx-gantt-theme` and calls
  `setSkin` when it differs from `gantt.skin`. Forcing the attribute in a
  verification latches `gantt.skin`, so removing it makes the poll write
  `terrace` back: an agent that reads `terrace` on a light page produced it
  itself, absent is the default. Nothing sets `material`, so its wider link
  handle never appears. `contrast-white`/`contrast-black` declare the variable
  as `contrast`, which has no block, so the poll rewrites the attribute to an
  inert value.
- **The splitter-drag veils are literal light greys, not variables**
  (`.gantt_resizing`, `.gantt_grid_resize_area`,
  `.gantt_row_grid_resize_area`); in dark they flash bright for the drag.
  Overridden in `gantt.css`'s dark block. The drag state arms on `pointerdown`
  + `pointermove`, and a synthetic `pointerup` does not fully disarm it:
  reload after emulating.
- **`gantt.templates.scale_cell_class` was dropped in v6** and still compiles.
  Scale-cell classes go through `css` on the scale config.
  `timeline_cell_class` shades whole cells; above day scale one cell spans
  working and non-working days, which is why non-working time is drawn as
  `posFromDate` bands.
- **The link handle's geometry lives on `:root`**
  (`--dhx-gantt-link-handle-offset`, `--dhx-gantt-link-handle-size`) and
  inherits into `.gantt_side_content.gantt_right`, which is why the label's
  `padding-left` clears the dot with `calc()` on those variables instead of a
  copied pixel count. The dot occupies the outer `size` of the handle's span.
- **A rule of ours stacked over the bars can steal the link handle's
  pointer**: `.gantt_side_content.gantt_right` carries a `z-index` to clear
  the time-off hatch and shares the dot's origin, so it covered the right
  handle. `.gantt_link_control { z-index: 3 }` puts the handle back on top.
  Anything of ours above a bar must let the pointer reach the handles.
- **`.gantt_side_content.gantt_link_crossing` lifts the label on a task with
  an outgoing link** (vendor rule), which is why the handle is partly
  reachable once a link exists and not before.

## Rendering lifecycle

- **`onGanttRender` fires before rows are sized**; `onDataRender` fires after
  rows are in the DOM (the today line listens to both).
- **dhtmlx rewrites the innards of `$task_bg` and `$bars_area` every render**:
  our elements inside them vanish. `$task_data` is the stable parent; children
  paint in DOM order (before `$bars_area` = under bars, after = over).
  `$task_bg` is full-rows tall; the data area is viewport-tall and scrolls.
- **`$grid.offsetWidth` is not the timeline's x origin**: two borders sit
  between them (the layout root's left border and the grid cell's right
  border, which `config.grid_width` counts and `$grid` does not). The resizer
  cell takes no horizontal space. For an overlay that must start where the
  bars do, measure `$task`'s left against `$root` (scroll-invariant;
  `$task_data`'s slides with the scroll).
- **At the horizontal scrollbar's maximum `getScrollState().x` can
  over-report the translation applied to `$task_data`**, by a sub-pixel
  fraction, at some device pixel ratios (the timeline cell's `clientWidth` is
  the integer rounding of a fractional width). Measured only at dpr 1, 1.25
  and 1.5; nothing here says what other ratios do. Read the applied
  translation instead, unrounded:
  `$task.getBoundingClientRect().left - $task_data.getBoundingClientRect().left`.
  An inline `left` serialises to six significant digits, so the fraction
  survives only while the offset is small.
- **Hand-set row classes don't survive a redraw**: classes must come from
  templates. A re-render also replaces the node under the pointer, killing
  hover.
- **Smart rendering: only bars in view exist in the DOM.** Counting
  `.gantt_task_line` undercounts silently. Read the task data, or
  `showTask(id)` then `getComputedStyle`.
- **Nothing `gantt.init()` depends on may change identity per render**:
  callbacks go into refs, init deps stay empty. This is about React identity,
  not about talking to the library: `gantt` is a module singleton, so code
  that touches no ref may import it directly.
- **Every registration on `gantt`, `document` or the container returns its
  own detach**, and the init effect's cleanup calls it; StrictMode mounts
  twice. A configuration slot (`gantt.templates.*`, `config.columns`) is not a
  registration: the init effect overwrites it and there is nothing to undo.
  The test is what a function does: `installRowTemplates` fills slots,
  `installPrintFigure` registers listeners and returns its detach.
- **A module-level read of `gantt.config.*` happens before the component
  body.** `MILESTONE_TYPE`/`BAR_TYPE` (`ganttRows.ts`) survive it because
  dhtmlx never writes `config.types`; `date_format` is assigned from the init
  effect, so `toGanttData` builds its formatter inside the call. Read config
  at call time unless you have checked who writes it and when.

## Timeline range and zoom

- **Range is computed at render time only.** `refreshData` redraws bars but
  never scales, so a task outside the range is not drawn.
  `config.start_date/end_date` pin it and outrank the data; `fitRangeToPlan`
  re-pins on the plan plus the widest task name, `zoomToFit` on the plan
  alone. `fit_tasks` honours the pin and misses the case that matters.
- **Both keys or neither**: the pin is read only when `start_date` and
  `end_date` are both set.
- **The library's own padding is one column, conditionally.** Pinned, it adds
  one only if the end fell mid-column. Unpinned, the data is padded by ±1
  column of the level's finest scale (`scales[1]`). A margin that must hold a
  name is counted in `config.min_column_width`, the narrowest a column renders
  at; on screen it comes out short as columns stretch.
- **`zoomToFit` preserves a pin it finds**: `rangeMode` defaults to `preserve`
  once both keys are set, and it saves the pin on its first run and restores
  it on every later one, so a range the plan has outgrown comes back with bars
  clamped on the edge. The app spells `rangeMode: 'target'`.
- **`onAfterZoom` is where a pixel-measured pin is re-measured**: recomputed
  from plan and level, never repaired against the standing pin (widening only
  would ratchet the range up over a zoom out and back). `render()` inside that
  handler does not recurse: the event fires after the extension's own render
  and scroll, once per zoom step. Nothing fires before `gantt.init()`.
- **A range narrower than the plan crops silently**: bars past it pile on the
  right edge, and if the timeline no longer overflows there is no scrollbar
  either. No path in the app reaches that state: `fitRangeToPlan` and the
  `onAfterZoom` repin always hold the plan. The coarsest level does not fit an
  arbitrarily long plan; what that costs is scrolling, not bars
  ([view.md](view.md)).
- Quarters are a custom scale unit (`<unit>_start` + `add_<unit>`).
- **Zoom ext's `useKey` is dead**: binds `mousewheel`, which Chromium no longer
  fires. The app binds `wheel` itself (`passive: false`; `useKey` stays out or
  Firefox zooms twice). Bursts → one step per gesture.
- **That wheel listener must be capture-phase and stop propagation**: dhtmlx's
  handler consumes the event when it scrolls. A synthetic `wheel` reproduces
  none of this, and a node cached before a zoom is detached by the redraw.
- **`zoomToFit` must run after a load, not inside it**: inside `loadProject`
  it leaves the ext's level index at `-1`, from which `zoomIn/zoomOut` are
  dead; visible only in `ext.zoom.getCurrentLevel()`. Fit sits in `App` after
  `loadProject` returns, which also lets undo keep its viewport.
- **Three ordering constraints in the init sequence**: `plugins()` before
  `init()`; the quarter unit registered before `ext.zoom.init()`; the
  grid/`$grid` width gap measured right after `init()`. Wrong order fails
  silently.

## Tooltip

- **`tooltip` extension is in Community**; `plugins()` is idempotent. It
  auto-attaches on `onGanttReady` over `[data-task-id]:not(.gantt_task_row)`,
  grid rows included. Replacing it = `detach` on that exact selector string,
  then your own `tooltipFor`. The app's is on `.gantt_task_line` only.
- **`tooltip_timeout` > `tooltip_hide_timeout` cancels the tooltip on a
  bar-to-bar move.** Real pointers re-arm via `mousemove`; a single synthetic
  hover doesn't. Test hovers with two events a pixel apart.
- **Tooltip node lives on `document.body`**, opens below-right of the pointer;
  `pointer-events: none` keeps it from describing the bar the pointer left.
- **Tooltip carries `z-index: 50`**: a fixed surface of ours near the chart
  needs more (`.rowmenu`), and an open popup suppresses it (`suppressTooltip`).

## Grid and editors

- **`grid_width` is a budget**: new columns shrink existing resizable ones
  toward `min_column_width`, silently. Compute `grid_width` from the columns'
  widths so the timeline pays.
- **dhtmlx's own `onGridResizeEnd` writes a divider drag back into
  `config.grid_width`.** No app code depends on it: `toggleGridCollapsed`
  measures `$grid.offsetWidth` fresh.
- **`select_task` doesn't select from grid clicks** (only bars). The app adds a
  `click` listener calling `selectTask` on the bubble phase: selecting
  re-renders the row, so a capture-phase select swallowed clicks on the expand
  arrow and `+`.
- **Inline editors open on a single click** regardless of
  `keyboard_navigation*`. **Editing rules go on
  `inlineEditors.attachEvent('onBeforeEditStart')`**: every way in passes
  through it.
- `resource` is reserved in the task type; the custom field is `resource_id`.
- **Refreshing the resource dropdown finds its column by `name ===
  'resource_id'`**: renaming it silently stops the options updating.
- **`gantt.render()` alone re-reads `config.columns`**; `resetLayout()` is not
  needed after a rebuild. Whether `refreshData` also re-reads the set is not
  measured.
- **A rebuild of `config.columns` drops the widths the user dragged** unless
  carried over by name; dhtmlx keeps a dragged width nowhere else.
  `rebuildColumns` copies them on every call site.
- **`moveTask(id, -1, parent)` appends.**
- **A parent that was a leaf renders collapsed**: set `$open` before adding a
  child under it.
- **`gantt.addTask` returns the id it actually used.** Use the return value.

## Drag and events

- **`round_dnd_dates` defaults to true and rounds to the finest on-screen
  scale cell.** Off here; `constraintStart` snaps to the working day instead,
  after deciding the start is a constraint at all.
- **One drag fires `onAfterTaskDrag` and `onAfterTaskUpdate`**, and by the
  second `applySolution` has written the solved start onto the row.
  `pullFromView` accepts a start only while ≠ solved, or derived turns into
  input and the drag lands twice in undo.
- **Dragging from the left handle creates a type-1 (start-to-start) link**,
  and `syncLinks` reads every link as finish-to-start. Refuse non-FS in
  `onBeforeLinkAdd`; the type is a view concept.
- **A synthetic link drag must start on `.gantt_link_point`**, not on the
  `.gantt_link_control` centre: a press off the point creates nothing and
  reports no error.
- **`onLinkDblClick` fires in Community, and `return false` suppresses the
  vendor modal.** Deletion is dhtmlx's own `gantt.confirm`
  ([verification.md](verification.md)).
- **`onAfterTaskMove` reports only the new parent**: read order back off the
  grid (`getChildren`, not `eachTask`; closed branches still have an order).
- **`$task_data` moves with the scroll; don't add the scroll to it.** Pointer →
  date is `dateFromPos(clientX - $task_data.getBoundingClientRect().left)`.
  The load lanes do add it and aren't a precedent: they draw in their own
  panel.
- **`onGanttScroll`'s `left` argument is stale in some firings, and the firing
  count depends on the gesture.** Never dedupe on a count; read the position
  back (`getScrollState().x` is right except at the maximum, above).
- **`ResizeObserver` never fires in the embedded browser.** dhtmlx measures
  its container at `init` and window resize only; anything of ours changing
  the chart's height calls `gantt.setSizes()`.
- **Refuse links in `onBeforeLinkAdd`**: by `onAfterLinkAdd`, `syncLinks()`
  has written the predecessors and `solve()` throws with the model mutated.
  `rejectionForLink` is the guard; mouse and script both go through it.
- **A column's `align` reaches its data cells, never its header**, the
  opposite of what the typings say. A header that must follow its column
  needs a rule of our own, with a different gutter (cells have padding,
  headers none).
- **The inline editor's input does not inherit the cell's `align`.**
- **A head cell spends its whole width on text and clips it without a sign**:
  `padding: 0`, `nowrap`, `overflow: hidden`, `text-overflow: clip`. Measure a
  label with a `Range` over the cell's contents minus one trailing
  `letter-spacing`. `text-overflow: ellipsis` is not the cheap fix: the
  browser reserves the ellipsis' width, so a header overflowing by a hair
  loses two characters. Width is the only lever.
- **The scale containers (`.gantt_grid_scale`, `.gantt_task_scale`) carry the
  vendor's `font-family: Inter…` and its `@font-face` from
  `fonts.gstatic.com`.** `font-family: inherit` on the cells does nothing: they
  inherit from the container. It is overridden on the two containers. Changing
  the header font moves every header's cut-off point, differently per column.
- **A column named `add` ignores its `template`**: the renderer emits a fixed
  `<div class='gantt_add'>` and delegates the click on it. Replacing the glyph
  means masking the pseudo-element (`gantt.css`, `.gantt_add::before`); the
  vendor pins a `color` there, so restate `color: inherit`.
