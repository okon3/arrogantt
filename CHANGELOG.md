# Changelog

## Unreleased

- Remove a dependency with the × that appears when you point at its arrow.
  Pointing at a task brings its arrows forward, so a busy plan stays readable.
- A task's pace periods leave a faint mark on its bar, so you can tell they
  are there without pointing at it.
- The task detail dialog is shorter: the computed figures are folded away
  until you open them, with the end date and duration always in sight.
- A group's bar takes the same colour as its tasks, blue included.
- See when a person's availability or rate period is overridden by one added
  below it: the earlier row says on how many days, or that it no longer
  applies at all.
- Give a task a description: free text in its detail dialog, for groups as
  well as single tasks, where the title alone does not carry what you mean.
  It comes out with the CSV export and is readable by a script.
- Close the gaps in a group from its right-click menu: linked tasks inside
  move up to start right after what they wait for.
- Set a task's pace in its detail dialog: fix it at an exact share of its
  person's time, for the whole task or for chosen periods, and the rest of
  their time goes to their other tasks. A period at 0% pauses the task.
  Right-click a bar and pick "Set pace from here" to start a period on the
  day you point at. Or set and adjust periods directly on the bar:
  double-click a day to start one, drag its edges to cover more days, drag
  its level up or down to change the percentage. A new period starts at the
  pace the task already has there, so adding it moves nothing. The periods
  of one task can no longer overlap.
- Pace periods belong to their task and move with it: drag the bar, change
  its start, or let whatever comes before it push it, and its periods stay
  on the same days of the task. A period never runs past the end of its
  task: when the task gets shorter the period is cut back with it.
- The percentages on a bar now show only while you point at it, so a plan
  at rest reads as shapes instead of a wall of figures.

## v1.6 — 2026-09-23

- Hide the grid and choose its columns from the status bar, beside Collapse
  and Expand: what changes the view sits under the chart, and the toolbar is
  left to the file, the exports and the plan itself.
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
