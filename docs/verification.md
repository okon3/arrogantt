# Verifying UI from an agent (embedded browser)

The app is developed and verified inside an embedded browser driven by an agent.
Some APIs behave differently there; some verifications can't be trusted or made
at all.

## The origin is fixed

Always `http://localhost:5173`: `strictPort` makes the dev server refuse to
start rather than slide to 5174, so a server that won't come up means an old
one is still holding the port — never that the app moved. `npm run dev:fresh`
kills that listener and starts a cold one. A measurement taken on a second
port was taken on a second app.

## Two agents, one origin

`localStorage` is per origin, not per agent: a second session on the same dev
server overwrote a measurement's fixtures halfway through, silently and with
no error, so the numbers described a project that was no longer the one under
test. Each agent that can reach the origin takes its own named browser
session — measured on `http://localhost:5173`, a key written under
`--session a` is absent from `--session b` and survives `b` writing over it,
so storage is isolated, not just cookies. The default unnamed session is the
shared one; never verify in it.

## Dialogs

- **`window.confirm` returns `false` instantly and shows nothing** — every
  guarded action becomes a silent no-op. Use `ConfirmDialog` (App owns it, hands
  it out as a promise; nested `<dialog>`s stack correctly).
- **dhtmlx's own confirm is not `window.confirm`, so deleting a link works.**
  Double-clicking a link opens `div.gantt_modal_box.gantt-alert` on `body`
  (z-index 18, OK/Cancel) — a DOM modal `gantt.confirm` builds itself; the OK is
  clickable and the deletion lands in undo. Nothing of ours configures it. The
  rule above does not reach it: reading the opposite out of the vendor source
  put a false premise in the plan, and only the running app removed it.
- **`window.print()` is the exception: it blocks.** Real modal dialog, invisible
  while the pane is hidden; every script hangs until dismissed, which an agent
  can't do (close and reopen the tab). Verify the print path by dispatching
  `beforeprint` on `window` (what `printPlan` listens to); the paper needs a
  person.
- **Reloading with fixtures on screen raises the browser's own "Reload site?"**
  — `App.tsx` arms a `beforeunload` guard while the project is dirty, and
  building fixtures with `window.arrogantt` makes it dirty, so every reload asks.
  It is a native dialog, not ours: nothing in the page can dismiss it. Under
  chrome-devtools MCP call `handle_dialog`; otherwise build the fixtures once
  and drive the page in place instead of reloading. A reload left unanswered
  blocks every later command on that page; once answered, the reload itself can
  cost two `os error 10060` timeouts before the page is back. Those are the
  wait, not a dead session: retry before concluding the app broke.
- **A dialog the tool cannot see is still on screen** — with the autosaved
  draft's question up, `dialog status` reported no dialog open and
  `find text "Resume" click` reported success while leaving it open. Only
  `snapshot -i`, then `click @eN` on the ref it printed, got out. A text match
  that reports success is not evidence the element was hit; the accessibility
  snapshot is.
- **A `<dialog>`'s `close` event never fires here** — probed on a fresh
  `<dialog>`: `showModal()`, `close('bye')` → `returnValue` set, `open` false,
  but neither `onclose` nor `addEventListener('close')` ran. The tool's
  synthetic Escape likewise produces no native `cancel`. So the `close` half of
  a dialog's wiring (`Dialog`'s `onCancel`/`onClose` → `onDismiss`) can't be
  exercised by driving the UI — dispatch a real `Event('close')` (or `'cancel'`)
  on the dialog node instead.

## Popups closing on outside click

Close-on-`pointerdown` + one-shot `click` eater does **not** work: React
unmounts the popup between the two events and the cleanup disarms the eater, so
the click opens an inline editor. `preventDefault` on pointerdown suppresses
compatibility mouse events for touch/pen only, not mouse. Correct shape: **one
`click` listener in the capture phase**, above dhtmlx's delegation root, that
closes and stops the event in the same breath. `RowMenu` is the case in hand —
and it is a non-modal `<dialog>` on purpose: `keystrokeIsCaptured` reads any
open dialog as "keys not aimed at the plan", which keeps Del off the row the
menu is about.

## Driving React inputs

A React-controlled field can't be filled from the browser tool's own context:
plain assignment is ignored by the value tracker, and the native
`HTMLInputElement.prototype` setter throws *Illegal invocation* from there.
Inject a `<script>` element with the same code — it runs in the page context,
the setter works, the `input` event reaches React. (How the details dialog's
date field is driven in verifications.)

**And the browser tool's own `fill` on an already-filled controlled field
fails silently, which is worse than the throw above**: the DOM `value` reads
back as asked while React's state keeps the old one, so the component saves
what was there before. Two agents hit it independently on the same field
(F5b's Currency, clearing `EUR`) and both first read it as an app defect.
Clearing needs either the injected setter or a real select-all + Backspace;
verify the model (`getResources()`, `getPlan()`), never the DOM value, that
an overwrite landed.

## Which `arrogantt` reads lag a write

A write through `window.arrogantt` and a read of its effect in the **same
evaluation** do not see the same instant, and which side of the line a getter
falls on decides whether a measurement means anything:

| Read | Sees |
| --- | --- |
| `getPlan()`, `getTask()`, `getSolved()`, `toText()`, `getResources()`, `getCalendar()` | the model, live — the refs are written before the call returns |
| `isDirty()`, `getFilename()` | the last **rendered** state: `agentState.current` is refreshed in an effect (`App.tsx:737-741`), so it still answers the pre-write value |
| Undo / Redo button `title` | React state, same lag |

So `arrogantt.setCurrency('EUR'); arrogantt.isDirty()` in one eval answers `false` on a
clean project, and the change is real. Read the lagging ones in a **separate**
evaluation — a turn later, or after two `requestAnimationFrame`s — and never
conclude "the write did not land" from them. Measured on F3b, where the undo
step count was read off the button title and only settled after the frame.

**And `toText()` is not byte-stable, whatever you do.** It serialises through
`serializeForFile` (`agentApi.ts:294-299`), which dates its `solved` report
with `solvedAt: serializeDate(new Date())` at minute precision
(`serialization.ts:80`). Two calls either side of a minute boundary therefore
differ on a project nobody touched, so **an accept phrased as raw byte
identity is undrivable**: normalise `solvedAt` away before comparing, and
never read a difference there as a write that landed. The input-only form —
what history, the draft and the `dirty` comparison use — carries no report and
does not move. Cost F5a two measurements, the lane's and the critic's, both
straddling the same minute.

## Synthetic keyboard events

Three harnesses drive keys here, and they differ in two independent ways —
trust and `keyCode`. Which one you used decides which handlers answered.

- **CDP `Input.dispatchKeyEvent`** (chrome-devtools MCP's `press_key`):
  trusted, real `keyCode` — measured on Tab: `keyCode 9`, `which 9`,
  `isTrusted: true`.
- **`agent-browser`'s key press**: trusted, but `keyCode`/`which`/`code` all
  `0`/empty; `event.key` is right. The instrument behind *Tool key naming*
  below and the `<dialog>`'s missing native `cancel` in *Dialogs*.
- **A hand-rolled `el.dispatchEvent(new KeyboardEvent('keydown', {...}))`**:
  untrusted, and `keyCode` is whatever the init dict says — Chrome honours it,
  so this harness can carry a real `keyCode` or `0` at will.

**The gate is `keyCode`, not trust.** An untrusted hand-rolled Tab carrying
`keyCode: 9` makes dhtmlx's own inline-editor keydown handler (`t.onkeydown`,
bundled, live without the `keyboard_navigation` extension) answer exactly as a
trusted CDP Tab does — same one call, same columns. The same handler stays
silent on `keyCode: 0`, and that gate is the whole of what separates the two
harnesses here.

**Both handlers honour `event.defaultPrevented`, and bubble order decides which
one acts.** `editorKeys` reads `event.key`, not `keyCode`, so the gate above
does not filter it: it receives every one of these keystrokes — the vendor's
`t.onkeydown` sits on the placeholder, inside the `.gantt-host` that carries
`editorKeys` — and the flag decides. On a real Tab or Enter the vendor runs
first, acts and raises it, so `editorKeys` stands down (document-level probe).
On `keyCode: 0` the vendor never answers, the flag stays `false`, and
`editorKeys` is the only handler that moves. It also acts on the real keys the
vendor *declines*: a trusted Shift+Enter fails the vendor's own `shiftKey &&
keyCode != TAB` test, arrives with the flag `false`, and `editorKeys` saves and
closes the editor. One keystroke, one call, on either harness.

Census on `gantt.ext.inlineEditors` — `startEdit`, `editNextCell`,
`editPrevCell`, `save`, `hide` wrapped, `new Error().stack` read to name the
caller — editor open on a leaf task's `text` cell unless a row says otherwise:

| Key | CDP (trusted, real `keyCode`) | hand-rolled, `keyCode: 0` |
| --- | --- | --- |
| Tab | `t.onkeydown` only, `editorKeys` stands down on `event.defaultPrevented`: **one** `editNextCell`, `text → resource_id` | `editorKeys` only (vendor stays silent on `keyCode: 0`): **one**, `text → resource_id` |
| Shift+Tab (from `nominal_days`) | **one** `editPrevCell`, `nominal_days → resource_id`, `editorKeys` stands down | **one**, `nominal_days → resource_id` |
| Tab, row edge (from `start_date`, a row's last editable cell) | **one** `editNextCell`, `1.start_date → 2.text` | **one**, `1.start_date → 2.text` |
| Shift+Tab, row edge (from `text`, a row's first editable cell) | **one** `editPrevCell`, `2.text → 1.start_date` | **one**, `2.text → 1.start_date` |
| Enter | `save`+`hide`, traced to `t.onkeydown` | `save`+`hide`, traced to `editorKeys` |
| Escape | `hide`, traced to `t.onkeydown` | no call; editor stays open |
| ArrowUp / ArrowDown | `hide`, traced to `t.onkeydown`, **no `save` first** — an open edit is discarded, not committed | no call; editor stays open |
| Delete | no `inlineEditors` call; the field's native edit applies | no call; no native edit |
| Space | no `inlineEditors` call; the field's native edit applies | no call; no native edit |

The Tab row is where the two handlers overlap — both answer it, and only the
`defaultPrevented` guard holds the count at one. The count, not the look of it,
is what an accept criterion can hold on to.

Neither handler is row-bounded — both pass `canChangeRow` true — so the row
edge is its own pair of cells above, driven rather than inferred from the
in-row ones.

**What this census did not drive** — absent cells, not absent behaviour:

- The `agent-browser` profile (trusted, `keyCode: 0`) on any of these keys. It
  is the third harness and only the other two were driven; do not assume it
  equals either.
- Whether Delete reaches `deleteSelected` (`GanttChart.tsx:927`) at runtime.
  Read only: it is a `document`-level listener that doesn't read `keyCode` and
  bails via `keystrokeIsCaptured` (`shortcuts.ts:14`) while an editor field
  holds focus. A hand-rolled dispatch without `bubbles: true` would never
  reach it, so a check built that way proves nothing about the guard.
- Which vendor code claims Space. No wrapped `inlineEditors` method was
  called under either harness, and no app-level handler binds it (grep over
  this repo — which says nothing about the library). Loaded vendor code does
  carry `SPACE` branches this census could not have seen: `inlineEditors`
  suppresses Space in its own `onShow` the moment an `ext.keyboardNavigation`
  object exists, and the core lightbox has another. Both are bundle reads — and
  together a reason not to bind Space as an app shortcut, since any probe that
  registers the nav extension arms the first one.

Tool key naming ≠ DOM naming, on `agent-browser`: `Return` arrives with an
**empty** `key` (does nothing); `Enter` arrives as `Enter`. A dead key is two
questions, not one.

## Emulated colour scheme

Switching the pane's scheme flips `matchMedia('(prefers-color-scheme: dark)')
.matches` and repaints every `@media` rule, but **fires no `change` event** — a
listener on that query is never called (measured: `matches` went true→false with
a probe listener armed, count stayed 0). So the JS half of the dark mode
(`theme.ts` setting `data-gantt-theme`) can only be verified **on load**, with
the scheme already set; a switch on a live page proves nothing about it. Which is
why the chart's dhtmlx variables are keyed on the media query as well as on the
attribute — see [dhtmlx.md](dhtmlx.md).

Setting `data-gantt-theme` by hand instead is not a shortcut to the same state:
dhtmlx polls the theme every 100ms and writes the attribute back, so forcing it
latches `gantt.skin` and removing it later yields `terrace` on a light page —
a value the app never sets. Load with the scheme already set, or measure only
what the attribute selects for. Mechanism in [dhtmlx.md](dhtmlx.md).

## Driving the CLI

Measured over 1179 real `agent-browser` invocations in this project's
transcripts. The failure rate is ~17%, not the 7.7% the tool-result error flag
reports — the gap is the first rule.

- **Never `;` between two `agent-browser` calls — `&&`, or one call per
  command.** With `;` a mid-chain failure still lets the last segment run, and
  a successful last segment marks the whole command a success: ~108 failures
  hid that way, visible only to whoever read the full output. `&&` doesn't
  prevent the failure, it stops it from being silent.
- **`Failed to read: … (os error 10060)` and `Invalid response: EOF … (daemon
  may be busy)` are worth exactly one immediate retry.** The largest failure
  bucket (35 calls, 8 sessions of 11) and mostly not the reload-after-dialog
  pattern above — only 4 of the 35 involve a reload. The daemon recovers on
  its own within seconds more often than not; the session is not dead.
- **`click` always takes an explicit selector.** `agent-browser click` alone is
  the single most repeated error signature in the corpus (`Missing arguments
  for: click`, six sessions, identical) — a reflex from CLIs where `click`
  follows the last match. Use `find … click`, or `snapshot` then `click @refN`.

- **An `eval` chained straight onto `open` races the app's first render.**
  `open` returns when the page is loaded, not when React has mounted and
  `window.arrogantt` exists: a fixture-building eval fired immediately throws
  inside its own callback (`at Array.forEach`), and with `&&` the rest of the
  chain never runs. A read taken that early reports zero elements and looks
  like a missing feature. Wait for a selector the app itself renders, or run
  the fixture as its own call and check what it returns.

- **`eval --stdin` from the PowerShell tool returns `null` with no error** — the
  pipe never reaches the daemon, so the read looks empty rather than failed. Use
  `eval -b <base64>`; every script carrying quotes goes through base64.
- **`mouse move` wants integer coordinates** — `Missing arguments` on `200.5`.
- **dhtmlx's link drag needs CDP-level input, so drive it with `agent-browser
  mouse move/down/up`.** Its `linksDnD` controller is bound to `$root` and
  ignores `MouseEvent`s sent with `dispatchEvent` — on the control, on the
  `elementFromPoint` target, on `document`, on `window`: `onBeforeLinkAdd`
  never fires. A lane read that silence as "a real link drag cannot be driven
  here" and swapped in a scripted `gantt.addLink`; the same gesture worked
  first try through the CLI. The canvas also exposes one accessibility node
  per bar, so uid-based `click`/`drag` have nothing to aim at — coordinates
  are the way in.
- **`elementFromPoint` inside a `.gantt_line_wrapper` returns its inner 2px div,
  not the wrapper.** Test with `contains`, not `===`, or every segment of a link
  reads as covered.
- **`dblclick <sel>` refuses when anything covers the target's centre** —
  including a sibling wrapper of the same link. Give the segment you want an id
  via `eval` and click that.
- **`window.gantt` is readable from an `eval`**: `getLinks`, `config` and
  `attachEvent` without touching code. Link ids are `"1->2"` strings after
  `loadText` (the app assigns them) and timestamps when drawn with the mouse.
- **The viewport command is `set viewport <w> <h> [scale]`, and the third
  argument is the `deviceScaleFactor`** — there is no `resize`, and looking for
  one led an agent to conclude a viewport measurement had no way in here.
  `set viewport 1600 612 2` measures `devicePixelRatio 2`, `innerWidth 1600`,
  and writes a 3200x1224 PNG: that is how a retina capture is taken.
  `set device` is no route to the same thing — this build offers only iPhone
  15/16/16 Pro/17, iPad, iPad Pro, Pixel 9, Galaxy S25, and refuses
  `Desktop Chrome HiDPI`.
- **A `set viewport` does not move the pointer, and the reflow can slide a row
  under it.** After a click in the status bar and a growth from 612 to 705,
  `:hover` read `.gantt_row.gantt-res-r2 > .gantt-avatar` — the row was
  highlighted and its icon in its active colour, in a screenshot meant to show
  the default state. Park the pointer on an inert area before any capture (two
  moves a pixel apart — one move does not fire), then read
  `.gantt_row:hover` back to zero.
- **A non-ASCII character survives a top-level return and not a structured
  one.** `return "resp-€-here"` answers correctly; the same character as an
  object **value** had its key silently dropped from the response, and inside a
  13-element array of strings it failed the whole call with
  `EOF while parsing a value at line 1 column 0`. So build the string in the
  page (`String.fromCharCode(8364)`) and report it as a char code, never as
  itself.
- **That same `EOF while parsing a value` can arrive after the script has
  already done its work.** A fixture calling `arrogantt.link()` nine times
  answers it every time, and the identical script with the nine calls removed
  answers normally — but the work landed: 13 tasks, 9 links and the right
  costs, read back in a separate evaluation. Never read that error as a script
  that did not run; read the state back before redoing anything.

What no rule fixes: JS errors in a hand-written `eval` (36 calls — a bug in the
script, not the tool), a selector covered by the sticky header, and `open` /
`wait --load networkidle` timing out on a cold server. The last is why the cold
restart happens *before* the measurement, not during it.

## Rules of thumb

- **Verify visuals with `getComputedStyle`** — not the attribute, not the data
  field. More than one bug was invisible from the code.
- **`scrollWidth` on an `<input>` ignores its placeholder.** An overflowing
  placeholder still reports `scrollWidth === clientWidth`, so the usual overflow
  test passes on unfixed code — it was prescribed as T37's accept criterion and
  would have accepted the defect. Measure the string's width at the live font
  against the input's **content box**, and mind which box: one field here is
  104px of track, 102px of padding box and 86px of content box, so a figure
  quoted without its box invites a second agent to disagree with the first.
- **Measuring whether a label fits: subtract one `letter-spacing`.** CSS adds
  the tracking after the *last* glyph too, so a `Range` over an element's
  contents reports ink + one space and a label that fits exactly reads as
  overflowing — the grid's `DURATION` measures 62.66px of rect in a 62px cell
  while its ink is 62.00 and nothing is cut. Mind the box as well: a
  `.gantt_grid_head_cell` has `padding: 0`, so its `clientWidth` *is* the
  content box, while the data cell below it has 6px a side. And read the
  cell's own `fontFamily` rather than the app's: the two disagree here
  (`docs/dhtmlx.md`).
- **On a block element `scrollWidth === clientWidth` whether the text wrapped
  or not**, so it cannot prove "no wrap". A `Range` over the text node and
  `getClientRects().length === 1` can — but **two rects are not a wrap when the
  element holds two text nodes** (`{formatDays(x)} d` renders as two), so
  compare the rects' `top` and `height` before calling it one. A lane read the
  two rects as ambiguous and a critic settled it by measuring; the cheap check
  is the `top`.
- **Smart rendering**: off-screen bars have no DOM node. Read the task data, or
  `showTask(id)` first.
- A synthetic `wheel` doesn't reproduce the scroll/zoom capture-phase interplay
  (see [dhtmlx.md](dhtmlx.md)), and a node cached before a zoom is detached by
  the redraw — events dispatched to it reach nothing.
- **Hover tests need two hovers a pixel apart**; hovering the pixel already
  under the pointer fires no event.
- `ResizeObserver` never fires here — code resizing the chart's container must
  call `gantt.setSizes()` itself.
- **Every `CSSStyleRule` carries a truthy but empty `cssRules`** (CSS
  nesting), so the usual container test — `if (r.cssRules) recurse(); else
  read(r.selectorText)` — walks the whole CSSOM and reads nothing: it
  reported 0 selectors on a page holding 955, which is indistinguishable from
  a page with no stylesheet. Read `selectorText` first and recurse only on
  `r.cssRules.length`. Then check the count against a known one before
  trusting the list it produced.
