# Changelog

## Unreleased

- Hide the grid and choose its columns from the status bar, beside Collapse
  and Expand: everything that changes the view now lives on one bar, and the
  toolbar is left to the file, the exports and the plan itself.
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
- See what the plan costs: a daily rate per person, rolled up on every summary
  and totalled in the status bar. Rates can change over time, and the CSV
  export carries them.
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
