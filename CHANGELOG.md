# Changelog

## v1.7 — 2026-11-21

- Give a person a colour in People: their avatar and their tasks take it,
  unless a task or its group has a colour of its own.
- A group's bar takes the colour of its tasks. Grey joins the colours, and
  "Auto" takes a colour off a task.
- A dependency into a closed group shows as a small arrow beside the bar:
  point at the bar to see where it goes.
- Remove a dependency with the × that appears when you point at its arrow.
- Close the gaps in a group from its right-click menu.
- Give a task a description in its detail dialog. It comes out in the CSV.
- Set a task's pace: an exact share of its person's time, for the whole task
  or for periods (0% pauses it), in its dialog or by dragging on the bar.
- Set a task's end yourself in its detail dialog: the bar keeps those dates
  whatever the plan does. Drag it, or its edges, to change them.
- Add work done in the background: with a set end and a pace of 0%, a task
  takes no time from the ones beside it.
- The task detail dialog is shorter: the computed figures are folded away.
- In People, a period overridden by a later one says so.

## v1.6 — 2026-09-23

- Hide the grid and choose its columns from the status bar, beside Collapse
  and Expand.
- A disabled task now reads as disabled everywhere: its whole row in the grid
  goes quiet and its name is struck through, not just the name greyed.
- Leave the disabled tasks out of an exported or printed picture, so what you
  hand over is the work someone has committed to.
- "For the client" now gives just the names and the bars: no columns at all,
  and no disabled tasks.

## v1.5 — 2026-09-21

- Choose what an exported or printed picture shows: the whole plan or the tree
  as you see it, and which columns come with it.
- One "For the client" button leaves out who is on the plan and what they cost.

## v1.4 — 2026-09-18

- Renamed to ARROGANTT. An unsaved draft and your column choices reset once.

## v1.3 — 2026-09-18

- Pick which columns the grid shows, remembered across a reload.
- See what the plan costs: a daily rate per person, changeable over time,
  rolled up on every summary and totalled in the status bar.
- Set the plan's currency in the People dialog.

## v1.2 — 2026-09-08

- 14 task colours to pick from instead of 7.
- Collapse the task grid to give the chart the whole window, and bring it back
  to the width it had.

## v1.1 — 2026-09-05

- Dark mode, following the system theme.
- Enable or disable a task straight from its row, without opening a dialog.

## v1.0 — 2026-09-04

- First public release: effort-based scheduling, critical chain, undo, .gantt
  files, CSV/PNG/print export and an agent API.
- Disable a row or a whole group: it stays on the plan as a placeholder but
  stops weighing on dates, load and the critical chain.
