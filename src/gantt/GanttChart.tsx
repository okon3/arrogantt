import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';
import { barFactsOf, renderBarTooltip } from './barTooltip';
import { reportedCost } from './cost';
import { isShared } from './segmentBar';
import { leafShare } from './taskShare';
import {
  registerQuarterUnit,
  ZOOM_LEVELS,
  SCALE_LABELS,
  WHEEL_ZOOM_COOLDOWN,
} from './zoomLevels';
import { fitRangeToPlan, repinRangeToScale, appliedScrollX } from './timelineGeometry';
import { hiddenLinksOf } from './hiddenLinks';
import { installBarActions } from './barActions';
import { isValidEffort, refuseTaskEdit } from './taskEdits';
import { installLinkHover } from './linkHover';
import { barRects, foldRows, glideBars, glideScrollX } from './motion';
import { installPaceHandles } from './paceHandles';
import { installRolledLinks } from './rolledLinks';
import { mountOverlays, nonWorkingSpans, paintBands, placeTodayLine } from './timelineOverlays';
import { isContended, type ShareOverride } from '../scheduler';
import { renderLoadPanel, scrollLoadPanel, type LoadLane } from './loadPanel';
import { DEFAULT_BAR_COLOR, resourceClass } from './colors';
import {
  chainAfterEdit,
  chainOnRequest,
  chainStateOf,
  closeGaps,
  constraintStart,
  dropDates,
  fixedEndOn,
  moveFixed,
  barColors,
  isChainMeasurable,
  isMilestone,
  rejectionForLink,
  rejectionForParent,
  reorderTasks,
  slackByRow,
  solve,
  subtreeOf,
  trimSharePeriods,
  type ChainState,
  type MarkedChain,
  type Project,
  type SolvedProject,
} from './project';
import {
  loadLanes,
  nextTaskId,
  rowFields,
  toGanttData,
  writeChainOntoRows,
} from './ganttRows';
import {
  DERIVED_ON_SUMMARY,
  buildColumns,
  quietHeaderSeparators,
  columnsWidth,
  installRowTemplates,
  refreshResourceOptions,
  type RowContext,
} from './gridColumns';
import { formatDay, formatDays } from './format';
import type { PlanColumnName } from './columns';
import { matchesSearch, searchKey } from './search';
import { keystrokeIsCaptured } from './shortcuts';
import type { GanttHandle, LoadOptions } from './ganttHandle';
import './gantt.css';

/**
 * Which branches the user has closed, so that reloading the project does not
 * open them all again — `toGanttData` renders every row open.
 */
function collapsedBranches(): Set<string> {
  const closed = new Set<string>();
  gantt.eachTask((task) => {
    if (!task.$open) closed.add(String(task.id));
  });
  return closed;
}

/**
 * Opens or closes every branch in one go.
 *
 * The whole tree is rewritten before a single redraw: `gantt.open` and
 * `gantt.close` each redraw on their own, which on a deep plan is one render
 * per row. `render` rather than `refreshData` because the row count changes —
 * it is what dhtmlx itself runs when a single branch opens.
 *
 * Nothing here touches the project. An open branch is a property of the view,
 * so this must not mark the file dirty.
 */
function setEveryBranchOpen(open: boolean): void {
  gantt.eachTask((task) => {
    task.$open = open;
  });
  gantt.render();
}

export function GanttChart({
  project,
  columns,
  highlighted,
  markCritical = true,
  showLoad = false,
  onChange,
  onOpenTask,
  onSelectionChange,
  onRowMenu,
  onToggleDisabled,
  onToggleAutoEnd,
  onSetPacePeriods,
  onDeleteTask,
  onAddTask,
  onScaleChange,
  onChainState,
  onReject,
  suppressTooltip = false,
  ref,
}: {
  project: Project;
  /** Which registry columns are on screen — view state, owned by the caller. */
  columns: ReadonlySet<PlanColumnName>;
  /** Whose work stays at full opacity while the rest of the plan fades. */
  highlighted?: string | null;
  /** Outlines the tasks the plan's end depends on. Costs a measurement per edit. */
  markCritical?: boolean;
  /** Opens the per-person load lanes under the chart, on its own time axis. */
  showLoad?: boolean;
  onChange?: () => void;
  onOpenTask?: (id: string) => void;
  /** Auto end on or off, from the bar's own buttons. */
  onToggleAutoEnd?: (id: string) => void;
  /** The selected task after every change of selection, null when none is. */
  onSelectionChange?: (id: string | null) => void;
  /** A right-click on a row, for the caller to answer with a menu of its own. */
  onRowMenu?: (target: {
    taskId: string;
    name: string;
    x: number;
    y: number;
    isSummary: boolean;
    isMilestone: boolean;
    /** The day the pointer was over, when it was over the timeline. */
    start?: Date;
    /** The task's own flag, not the effective (inherited) state. */
    disabled: boolean;
  }) => void;
  /** The grid's per-row power button — same action as the menu's Enable/Disable. */
  onToggleDisabled?: (taskId: string, ownDisabled: boolean) => void;
  /** A leaf's pace periods as a gesture on its bar left them, already through `parseTaskShare`. */
  onSetPacePeriods?: (taskId: string, periods: ShareOverride[]) => void;
  /** Asked, not done: the confirmation belongs with the rest of the dialogs. */
  onDeleteTask?: (id: string) => void;
  /** The grid header's "+": a new task at the end of the plan. */
  onAddTask?: () => void;
  onScaleChange?: (label: string) => void;
  /** Whether the marking is live, has to be asked for, or is showing an old answer. */
  onChainState?: (state: ChainState) => void;
  /** Why an edit made in the chart was refused, for the caller to surface. */
  onReject?: (message: string) => void;
  /** Quiets the bar tooltip while a caller's popup sits over the chart. */
  suppressTooltip?: boolean;
  ref?: Ref<GanttHandle>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const hintRule = useRef<HTMLStyleElement | null>(null);
  const loadHost = useRef<HTMLDivElement>(null);
  // Held in a ref because the dhtmlx handlers are registered once, in an effect
  // that must not re-run when a callback identity changes.
  const openTaskRef = useRef(onOpenTask);
  const selectionRef = useRef(onSelectionChange);
  const rowMenuRef = useRef(onRowMenu);
  const toggleDisabledRef = useRef(onToggleDisabled);
  const toggleAutoEndRef = useRef(onToggleAutoEnd);
  const setPacePeriodsRef = useRef(onSetPacePeriods);
  const deleteTaskRef = useRef(onDeleteTask);
  const addTaskRef = useRef(onAddTask);
  const scaleChangeRef = useRef(onScaleChange);
  const changeRef = useRef(onChange);
  const rejectRef = useRef(onReject);
  const projectRef = useRef(project);
  // Mutated only through `setColumns` (and read once, at init, for the first
  // paint) — the same uncontrolled-after-mount shape as `projectRef`, never a
  // prop the init effect watches.
  const shownRef = useRef(columns);
  // Lazily, or `solve` runs on every render and its answer is thrown away on
  // all but the first. That waste is the smaller half: this is the only solve
  // on the render path, and a model that cannot be scheduled throws here where
  // there is no handler to catch it — the tree unmounts instead of showing the
  // error the re-render was about to paint. Solved once per mount; every solve
  // after it belongs to `applySolution`, inside an event handler.
  const [solvedAtMount] = useState(() => solve(project));
  const solvedRef = useRef<SolvedProject>(solvedAtMount);
  const applyingRef = useRef(false);
  // Also what the marking effect below compares against, so mounting does not
  // re-apply what the first parse already drew.
  const markCriticalRef = useRef(markCritical);
  // The chain outlives an edit: over the limit it is not re-measured, and what
  // was measured before stays on the rows marked as old.
  const chainRef = useRef<MarkedChain | null>(null);
  const chainStateRef = useRef(onChainState);
  const showLoadRef = useRef(showLoad);
  // The lanes are aggregated from the schedule, so they are recomputed once per
  // solve and not once per redraw — a zoom or a scroll only moves the geometry.
  const lanesRef = useRef<{ solved: SolvedProject; lanes: LoadLane[] } | null>(null);
  // Owned by the effect that builds the panel, called by the toggle below it.
  const repaintLoadRef = useRef<() => void>(() => {});
  // What the row templates test a name against. A ref rather than a field on
  // each row: dhtmlx rebuilds the rows on every redraw and a class of ours has
  // to come from a template, and a template asking one question of one value
  // cannot fall out of step with the query the way a copy per row would.
  const searchKeyRef = useRef('');
  // The grid's width the moment it was collapsed, null while it is open.
  // `$grid.offsetWidth` is read live rather than `config.grid_width` — not
  // because the latter is known stale (dhtmlx's own `onGridResizeEnd` does
  // keep it in step with a real drag, measured in docs/dhtmlx.md), but
  // defensively: no handler in this app's own code observes that event, so
  // nothing here should depend on an internal side effect it doesn't own.
  // The DOM is what a drag is guaranteed to have moved.
  const savedGridWidthRef = useRef<number | null>(null);
  // The constant gap between `$grid.offsetWidth` and what `config.grid_width`
  // expects — measured once, right after init (docs/dhtmlx.md: two borders sit
  // between grid and timeline, and config counts one that `$grid` does not).
  // A property of the layout, not of the width, so one measurement holds for
  // every collapse.
  const gridWidthGapRef = useRef(0);
  const suppressTooltipRef = useRef(suppressTooltip);

  useEffect(() => {
    suppressTooltipRef.current = suppressTooltip;
    // Hovering preceded the popup, so a tooltip may already be up.
    if (suppressTooltip) gantt.ext.tooltips.tooltip.hide();
  }, [suppressTooltip]);

  useEffect(() => {
    openTaskRef.current = onOpenTask;
    selectionRef.current = onSelectionChange;
    rowMenuRef.current = onRowMenu;
    toggleDisabledRef.current = onToggleDisabled;
    toggleAutoEndRef.current = onToggleAutoEnd;
    setPacePeriodsRef.current = onSetPacePeriods;
    deleteTaskRef.current = onDeleteTask;
    addTaskRef.current = onAddTask;
    scaleChangeRef.current = onScaleChange;
    changeRef.current = onChange;
    rejectRef.current = onReject;
    chainStateRef.current = onChainState;
  }, [
    onChainState,
    onChange,
    onDeleteTask,
    onAddTask,
    onOpenTask,
    onSelectionChange,
    onToggleAutoEnd,
    onReject,
    onRowMenu,
    onScaleChange,
    onSetPacePeriods,
    onToggleDisabled,
  ]);

  /** Says which of the three the control has to offer, after every write to the chain. */
  const reportChainState = useCallback(() => {
    chainStateRef.current?.(
      chainStateOf(markCriticalRef.current, solvedRef.current, chainRef.current),
    );
  }, []);

  const applySolution = useCallback(
    (notify = true) => {
      applyingRef.current = true;
      try {
        const solved = solve(projectRef.current);
        // Here, so the cut lands in the history step of whatever edit shortened
        // the task — and before the chain below re-solves the engine tasks.
        trimSharePeriods(projectRef.current, solved);
        solvedRef.current = solved;
        // Measured after the schedule and from it, so the two can never disagree
        // about the plan they describe — or, over the limit, kept and called old.
        chainRef.current = chainAfterEdit(
          projectRef.current,
          solved,
          markCriticalRef.current,
          chainRef.current,
        );
        const colorOf = barColors(projectRef.current, solved.hierarchy);
        for (const task of projectRef.current.tasks) {
          const scheduled = solved.schedule.tasks.get(task.id);
          if (!scheduled || !gantt.isTaskExists(task.id)) continue;
          Object.assign(gantt.getTask(task.id), rowFields(task, solved, colorOf), {
            start_date: scheduled.start,
            end_date: scheduled.end,
          });
        }
        writeChainOntoRows(projectRef.current, chainRef.current);
        const drawn = barRects();
        // refreshData redraws from the mutated task objects without firing the
        // update events that would bounce straight back into this function.
        gantt.refreshData();
        fitRangeToPlan(solved.schedule);
        glideBars(drawn);
      } finally {
        // Even if a solve throws: left on, the flag silently drops every later edit.
        applyingRef.current = false;
      }
      reportChainState();
      if (notify) changeRef.current?.();
    },
    // Nothing that changes identity per render. This function is a dependency of
    // the effect that calls gantt.init(), so an identity that changed with every
    // render of the parent would tear the chart down and rebuild it on every
    // keystroke — and gantt.ext.zoom.init() would reset the zoom level while
    // doing so. `reportChainState` has no dependencies of its own either.
    [reportChainState],
  );

  /**
   * The one place the column set is rebuilt: a picker change, or a load whose
   * project may change a header label later. Never from `applySolution` —
   * nothing there changes which columns exist.
   */
  const rebuildColumns = useCallback(() => {
    const rowContext: RowContext = {
      project: () => projectRef.current,
      solved: () => solvedRef.current,
      searchKey: () => searchKeyRef.current,
    };
    // The registry owns which columns exist, never how wide the user dragged
    // them: a rebuild that forgot the widths would re-truncate every name.
    const dragged = new Map((gantt.config.columns ?? []).map((column) => [column.name, column.width]));
    const rebuilt = buildColumns(rowContext, shownRef.current);
    for (const column of rebuilt) {
      const width = dragged.get(column.name);
      if (width !== undefined) column.width = width;
    }
    gantt.config.columns = rebuilt;
    quietHeaderSeparators(rebuilt);
    if (savedGridWidthRef.current !== null) {
      // Collapsed: `grid_width` stays 0, and the new budget becomes what a
      // restore hands back — a divider drag from before the rebuild is
      // forgotten, which is fine for view state.
      savedGridWidthRef.current = columnsWidth(gantt.config.columns);
    } else {
      gantt.config.grid_width = columnsWidth(gantt.config.columns);
    }
    gantt.render();
  }, []);

  const loadProject = useCallback(
    (next: Project, options?: LoadOptions) => {
      // clearAll drops the selection and sends the timeline back to where the
      // plan starts, which for an undo would mean losing the row and the week
      // the user was looking at. The zoom level survives on its own: it lives
      // in the extension rather than in the data.
      const scroll = options?.keepViewport ? gantt.getScrollState() : undefined;
      const selected = options?.keepViewport ? gantt.getSelectedId() : undefined;
      const collapsed = options?.keepViewport ? collapsedBranches() : undefined;
      // Before anything is replaced: a project the engine refuses must leave
      // the open one, and the `applying` flag, exactly as they were.
      const solved = solve(next);
      // A hand-written file may reach past a task's end. Cut here, on the
      // project the caller goes on to snapshot, or the first solve after it
      // would change the model with no edit to answer for it.
      trimSharePeriods(next, solved);
      // Undo and redo only: a file or a new plan has nothing to slide from.
      const drawn = options?.keepViewport ? barRects() : new Map<string, DOMRect>();
      applyingRef.current = true;
      try {
        projectRef.current = next;
        solvedRef.current = solved;
        // An undo keeps the marking it had — over the limit as a stale one — since
        // it is the same plan a step back, and dropping it would leave a big plan
        // with nothing marked after every Ctrl+Z. A file, a draft or a new project
        // is a different plan, and a marking measured against the one that was
        // open says nothing about it.
        chainRef.current = chainAfterEdit(
          next,
          solvedRef.current,
          markCriticalRef.current,
          options?.keepViewport ? chainRef.current : null,
        );
        gantt.clearAll();
        const data = toGanttData(next, solvedRef.current, chainRef.current);
        // Written into the data rather than onto the tasks afterwards, which would
        // need a second render of the whole chart to show.
        for (const task of data.data) {
          if (collapsed?.has(String(task.id))) task.open = false;
        }
        gantt.parse(data);
        // The loaded project may carry a different `currency` than the one the
        // headers were built from — the label lives on the two new columns'
        // `label(project)`, which nothing else here re-reads.
        rebuildColumns();
        refreshResourceOptions(next.resources);
        fitRangeToPlan(solvedRef.current.schedule);
      } finally {
        applyingRef.current = false;
      }
      // After the render, or fitRangeToPlan would scroll back over it.
      if (scroll) gantt.scrollTo(scroll.x, scroll.y);
      // The row may be one of those the undone change had created.
      if (selected && gantt.isTaskExists(selected)) gantt.selectTask(selected);
      glideBars(drawn);
      reportChainState();
    },
    [reportChainState, rebuildColumns],
  );

  useImperativeHandle(
    ref,
    () => ({
      getProject: () => projectRef.current,
      getSolved: () => solvedRef.current,
      loadProject,
      getTaskDetails: (id) => {
        const task = projectRef.current.tasks.find((candidate) => candidate.id === id);
        const scheduled = solvedRef.current.schedule.tasks.get(id);
        if (!task || !scheduled) return null;
        const solved = solvedRef.current;
        const summary = solved.summaryIds.has(id);
        const cost = solved.costs.get(id)!;
        return {
          id,
          name: task.name,
          ...(task.description === undefined ? {} : { description: task.description }),
          nominalDays: task.nominalDays,
          start: scheduled.start,
          end: scheduled.end,
          // The model may still hold the resource a summary had while it was a
          // leaf. The engine ignores it and every write here discards it, so
          // reading it out would report an assignment nobody is working —
          // buildPlan already answers null for the same reason.
          resourceId: summary ? '' : task.resourceId ?? '',
          color: task.color,
          paintedColor: barColors(projectRef.current, solved.hierarchy)(id) ?? DEFAULT_BAR_COLOR,
          autoColor:
            barColors(
              {
                resources: projectRef.current.resources,
                tasks: projectRef.current.tasks.map((each) =>
                  each.id === id ? { ...each, color: undefined } : each,
                ),
              },
              solved.hierarchy,
            )(id) ?? DEFAULT_BAR_COLOR,
          ownsColor: task.parentId === undefined,
          progress: task.progress ?? 0,
          isSummary: summary,
          descendantCount: subtreeOf(projectRef.current.tasks, id).size - 1,
          elapsedDays: solved.calendar.minutesToDays(scheduled.elapsedWorkingMinutes),
          effortDays: solved.calendar.minutesToDays(scheduled.effortMinutes),
          shared: isShared(scheduled),
          contended: isContended(scheduled),
          disabled: task.disabled === true,
          ...leafShare(task, summary),
          ...(task.fixedEnd && !summary ? { fixedEnd: task.fixedEnd } : {}),
          cost: reportedCost(cost),
          uncostedDays: cost.uncostedDays,
          dailyRates: [...cost.dailyRates],
          currency: solved.currency,
        };
      },
      getTaskSlack: (id) => {
        const solved = solvedRef.current;
        if (!isChainMeasurable(solved)) return null;
        const slack = slackByRow(projectRef.current, solved, { search: true, ids: [id] }).get(id);
        // The figure was asked for, so its absence means the row is gone rather
        // than unmeasured — and either way there is nothing to show.
        if (!slack || slack.floatDays === null) return null;
        return { ...slack, floatDays: slack.floatDays };
      },
      measureCriticalChain: () => {
        applyingRef.current = true;
        try {
          chainRef.current = chainOnRequest(projectRef.current, solvedRef.current);
          // The ref is what the rows were drawn from, so putting the marking on
          // here is also what keeps the toggle effect from firing a second time
          // and calling this very measurement old.
          markCriticalRef.current = true;
          writeChainOntoRows(projectRef.current, chainRef.current);
          gantt.refreshData();
        } finally {
          applyingRef.current = false;
        }
        reportChainState();
      },
      deleteTask: (id) => {
        // gantt.deleteTask fires onAfterTaskDelete, where the model, the
        // dependencies and the schedule are already dealt with.
        if (gantt.isTaskExists(id)) gantt.deleteTask(id);
      },
      updateTask: (id, patch) => {
        const task = projectRef.current.tasks.find((candidate) => candidate.id === id);
        if (!task || !gantt.isTaskExists(id)) return;
        // Every way in passes here, so the rules do too: callers turn the throw
        // into their own refusal (the panel's message, a script's exception).
        const refusal = refuseTaskEdit(task, patch);
        if (refusal) throw new Error(refusal);
        task.name = patch.name;
        // No progress and zero progress are the same thing, and the dialog
        // cannot show the field as empty: a zero coming back on every save is
        // what the view invented to show the task, not something it declares.
        task.progress = patch.progress || undefined;
        // Same rules the grid enforces: a summary derives its effort, start and
        // resource from the leaves, and a subtask inherits its parent's colour.
        if (task.parentId === undefined) {
          task.color = patch.color || undefined;
        }
        if (!solvedRef.current.summaryIds.has(id)) {
          task.nominalDays = patch.nominalDays;
          // The dialog's date field opens on the solved start and a script fills
          // an omitted one from it, so most saves hand back a date nobody chose.
          const { calendar } = solvedRef.current;
          const fixed = patch.fixedEnd === undefined ? task.fixedEnd : patch.fixedEnd;
          // A fixed task is where it was said to be: the start shown is the one
          // declared, so handing it back declares it — unlike a derived one.
          task.start = fixed
            ? calendar.startOfWorkingDay(patch.start)
            : constraintStart(task, patch.start, solvedRef.current);
          if (fixed) task.fixedEnd = fixedEndOn(calendar, task.start, fixed);
          else delete task.fixedEnd;
          task.resourceId = patch.resourceId;
          if (patch.share === null) delete task.share;
          else if (patch.share !== undefined) task.share = patch.share;
          if (patch.shareOverrides?.length) task.shareOverrides = patch.shareOverrides;
          else if (patch.shareOverrides) delete task.shareOverrides;
        }
        // Not derived from the leaves — a summary can be disabled on its own,
        // same as a leaf. Undefined means the caller left it alone; only `true`
        // and `false` write, and `false` deletes the key rather than storing it,
        // since absence is the only spelling of "enabled" the file format knows.
        if (patch.disabled !== undefined) {
          if (patch.disabled) task.disabled = true;
          else delete task.disabled;
        }
        if (patch.description !== undefined) {
          if (patch.description) task.description = patch.description;
          else delete task.description;
        }
        applyingRef.current = true;
        const ganttTask = gantt.getTask(id);
        ganttTask.text = task.name;
        ganttTask.progress = task.progress ?? 0;
        ganttTask.resource_id = task.resourceId ?? '';
        applyingRef.current = false;
        applySolution();
      },
      closeGaps: (summaryId) => {
        const tasks = closeGaps(projectRef.current, solvedRef.current, summaryId);
        if (tasks === projectRef.current.tasks) return;
        projectRef.current.tasks = tasks;
        applySolution();
      },
      getResources: () => projectRef.current.resources,
      setResources:(resources, releasedResourceIds, currency) => {
        projectRef.current.resources = resources;
        const released = new Set(releasedResourceIds);
        for (const task of projectRef.current.tasks) {
          if (task.resourceId && released.has(task.resourceId)) task.resourceId = undefined;
        }
        // Absent (commitResources' two-argument call) leaves the label alone;
        // written here, before applySolution, so the People dialog's rates and
        // currency land in the same snapshot instead of costing two undo steps.
        if (currency !== undefined) {
          if (currency === null) delete projectRef.current.currency;
          else projectRef.current.currency = currency;
        }
        refreshResourceOptions(resources);
        applySolution();
        // Same reason setCurrency rebuilds after applySolution: the two cost
        // headers read project.currency and would otherwise show the old label
        // until some other trigger came along.
        if (currency !== undefined) rebuildColumns();
      },
      getCalendar: () => projectRef.current.calendar,
      setCalendar: (calendar) => {
        projectRef.current.calendar = calendar;
        // Shutdowns leave the time axis, so every date shifts: the timeline
        // scales have to be redrawn, not just the task data.
        applySolution();
        gantt.render();
      },
      setCurrency: (label) => {
        // Absent, not empty: `JSON.stringify` drops an `undefined` property, so
        // this is what makes "cleared" and "never set" the same file on disk.
        if (label === null) delete projectRef.current.currency;
        else projectRef.current.currency = label;
        applySolution();
        // The two new headers read `project.currency` (`columns.ts`): a
        // currency change without this leaves them showing the old label
        // until some other rebuild trigger comes along.
        rebuildColumns();
      },
      countTasksByResource: () => {
        const counts = new Map<string, number>();
        for (const task of projectRef.current.tasks) {
          if (!task.resourceId) continue;
          counts.set(task.resourceId, (counts.get(task.resourceId) ?? 0) + 1);
        }
        // Resources with no tasks must still appear, or the dialog cannot show a zero.
        for (const resource of projectRef.current.resources) {
          if (!counts.has(resource.id)) counts.set(resource.id, 0);
        }
        return counts;
      },
      addTask: (task) => {
        const start = task?.start ? new Date(task.start) : new Date();
        const effort = task?.nominalDays ?? 1;
        // Below a named row: the parent is that row's, and the index is one past
        // it. dhtmlx counts the index within the branch, which is exactly the
        // arrangement `pullOrderFromView` then writes into the model.
        const sibling =
          task?.after && gantt.isTaskExists(task.after) ? gantt.getTask(task.after) : undefined;
        const parent = sibling ? (sibling.parent ?? 0) : (task?.parentId ?? 0);
        const index = sibling ? gantt.getTaskIndex(task!.after!) + 1 : undefined;
        // A parent that was a leaf until now renders collapsed, which would hide
        // the row that was just created.
        if (parent && gantt.isTaskExists(parent)) {
          gantt.getTask(parent).$open = true;
        }
        // No applying flag and no write to the model here: onAfterTaskAdd is the
        // single path that turns a dhtmlx row into a project task, and it
        // already honours whatever data the row carries. Adding a second path
        // is how the grid's "+" button once produced rows with a NaN duration.
        const id = String(
          gantt.addTask(
            {
              id: nextTaskId(projectRef.current),
              text: task?.name ?? 'New task',
              start_date: gantt.date.date_to_str(gantt.config.date_format)(start),
              parent,
              duration: 1,
              progress: 0,
              resource_id: task?.resourceId ?? '',
              nominal_days: effort,
              rolled_effort_days: effort,
              elapsed_days: effort,
              is_summary: false,
              bar_color: task?.color ?? '',
              own_color: task?.color ?? '',
              shared: false,
              disabled: task?.disabled ?? false,
              // Overwritten by the applySolution() onAfterTaskAdd triggers —
              // never rendered as anything but these placeholders.
              cost_amount: null,
              cost_costed_days: 0,
              cost_uncosted_days: 0,
              daily_rates: [],
            },
            parent,
            index,
          ),
        );
        gantt.showTask(id);
        return id;
      },
      setParent: (id, parentId) => {
        // -1 appends at the end of the new parent's children, the convention
        // dhtmlx's own shift+right indent uses.
        const target = parentId ?? gantt.config.root_id;
        if (parentId && gantt.isTaskExists(parentId)) gantt.getTask(parentId).$open = true;
        // onAfterTaskMove writes task.parentId and re-solves, so nothing else
        // may touch the model here.
        gantt.moveTask(id, -1, target);
      },
      addLink: (from, to) => {
        const exists = gantt
          .getLinks()
          .some((link) => String(link.source) === from && String(link.target) === to);
        if (exists) return;
        gantt.addLink({ source: from, target: to, type: gantt.config.links.finish_to_start });
      },
      removeLink: (from, to) => {
        const link = gantt
          .getLinks()
          .find((entry) => String(entry.source) === from && String(entry.target) === to);
        if (link) gantt.deleteLink(link.id);
      },
      selectTask: (id) => gantt.selectTask(id),
      // A rule, not a class: dhtmlx redraws the row and the bar and would drop it.
      hintTask: (id) => {
        if (!hintRule.current) hintRule.current = document.head.appendChild(document.createElement('style'));
        hintRule.current.textContent = id
          ? `.gantt-host .gantt_row[data-task-id="${CSS.escape(id)}"],` +
            `.gantt-host .gantt_task_row[data-task-id="${CSS.escape(id)}"]{background:var(--surface-hover)}` +
            `.gantt-host .gantt_task_line[data-task-id="${CSS.escape(id)}"] .bar-ring{display:block}`
          : '';
      },
      revealTask: (id) => {
        if (!gantt.isTaskExists(id)) return;
        // A row inside a closed branch has no position on the chart, so
        // showTask would scroll to wherever the closed parent sits. Opening a
        // branch is a property of the view and marks nothing dirty.
        let opened = false;
        for (const ancestorId of solvedRef.current.hierarchy.ancestorsOf(id)) {
          if (!gantt.isTaskExists(ancestorId)) continue;
          const ancestor = gantt.getTask(ancestorId);
          if (ancestor.$open) continue;
          ancestor.$open = true;
          opened = true;
        }
        // The number of rows changed, which refreshData does not lay out again.
        if (opened) gantt.render();
        gantt.showTask(id);
      },
      setSearch: (query) => {
        const key = searchKey(query);
        // Only a change of query needs a redraw of its own. After an edit this
        // is asked again with the same query, against a plan whose rows
        // `applySolution` has already redrawn.
        if (key !== searchKeyRef.current) {
          searchKeyRef.current = key;
          gantt.refreshData();
        }
        if (key === '') return [];
        const found: string[] = [];
        // eachTask walks the whole tree in the order the grid lays it out,
        // closed branches included — a match one cannot see yet is still a
        // match, and revealing it is what opens the branch.
        gantt.eachTask((task) => {
          if (matchesSearch(String(task.text ?? ''), key)) found.push(String(task.id));
        });
        return found;
      },
      zoomIn: () => gantt.ext.zoom.zoomIn(),
      zoomOut: () => gantt.ext.zoom.zoomOut(),
      // `rangeMode` spelt out because its default reads the range that is
      // already pinned and switches to preserving it: with `fitRangeToPlan`
      // leaving a pin behind, Fit would pick a level and no more — and,
      // restoring the pin it saved on its first run, it would choose that level
      // against a range the plan has since outgrown and render it, drawing the
      // bars that reach past it clamped on the timeline's edge, before
      // `onAfterZoom` puts the range right.
      zoomToFit: () => gantt.ext.zoom.zoomToFit({ rangeMode: 'target' }),
      collapseAll: () => setEveryBranchOpen(false),
      expandAll: () => setEveryBranchOpen(true),
      collapsedBranches: () => collapsedBranches(),
      scrollToToday: (glide) => {
        if (!glide) return gantt.showDate(new Date());
        // showDate picks the target; it is undone before the frame paints.
        const from = gantt.getScrollState().x;
        gantt.showDate(new Date());
        const to = gantt.getScrollState().x;
        gantt.scrollTo(from, null);
        glideScrollX(to);
      },
      toggleGridCollapsed: () => {
        const grid = gantt.$grid;
        if (!grid) return;
        if (savedGridWidthRef.current === null) {
          savedGridWidthRef.current = grid.offsetWidth + gridWidthGapRef.current;
          gantt.config.grid_width = 0;
        } else {
          gantt.config.grid_width = savedGridWidthRef.current;
          savedGridWidthRef.current = null;
        }
        // `setSizes` is a literal alias of `render` in the installed build;
        // the non-refresh branch it takes calls `$layout.resize()`, which is
        // what actually reapplies `grid_width` to the DOM (as in
        // `setEveryBranchOpen` and the `showLoad` effect).
        gantt.render();
      },
      // View state, like `toggleGridCollapsed`: no undo step, no dirty flag —
      // unlike it, the caller persists the choice across a reload.
      setColumns: (shown) => {
        shownRef.current = shown;
        rebuildColumns();
      },
    }),
    [applySolution, loadProject, rebuildColumns, reportChainState],
  );

  useEffect(() => {
    const container = host.current;
    if (!container) return;

    const rowContext: RowContext = {
      project: () => projectRef.current,
      solved: () => solvedRef.current,
      searchKey: () => searchKeyRef.current,
    };

    // Also localises month and weekday names in the timeline scales, and the
    // default name dhtmlx gives to rows created from the grid.
    gantt.i18n.setLocale('en');
    gantt.config.date_format = '%Y-%m-%d %H:%i';
    // dhtmlx rounds a drop to the cell of the finest scale on screen, and on a
    // plan long enough to need the month or quarter view that cell is a month:
    // a nudge of a few pixels on 23 September lands the task on 1 October, with
    // nothing on screen to say so. The exact instant under the pointer is the
    // honest input, and `constraintStart` snaps it to the working day it fell
    // on — a scale the plan can always show.
    gantt.config.round_dnd_dates = false;
    // On for the one kind of bar whose end is an input: a task with fixed
    // dates. Everywhere else the end is computed, and `onBeforeTaskDrag`
    // refuses an edit the engine would immediately overwrite.
    gantt.config.drag_resize = true;
    gantt.config.drag_progress = true;
    gantt.config.drag_links = true;
    gantt.config.details_on_dblclick = false;
    // The lightbox cannot edit effort or resource, so creating through it would
    // only add a row the user then has to fix in the grid anyway.
    gantt.config.details_on_create = false;
    // Lets rows be dragged to re-parent and reorder, which is how the hierarchy
    // is built.
    gantt.config.order_branch = true;
    gantt.config.order_branch_free = true;
    gantt.config.row_height = 36;
    gantt.config.bar_height = 24;
    gantt.config.columns = buildColumns(rowContext, shownRef.current);
    gantt.config.grid_width = columnsWidth(gantt.config.columns);

    installRowTemplates(rowContext);

    // Before init: the extension hangs its own tooltip off onGanttReady, which
    // fires inside init. Community ships it — unlike addTaskLayer, it is not one
    // of the calls the build deletes — and calling plugins() twice is a no-op,
    // which StrictMode's second mount depends on.
    gantt.plugins({ tooltip: true });
    // The extension's own 30ms means a pointer crossing the chart trails a
    // tooltip per bar. Long enough to be asked for, short enough to be a hover.
    gantt.config.tooltip_timeout = 220;

    // Before the zoom levels, two of which are declared in quarters.
    registerQuarterUnit();
    // No useKey: the extension's own ctrl+wheel binds "mousewheel", which this
    // browser no longer fires at all, and it would bind "wheel" in Firefox —
    // where it would then zoom twice per notch alongside the listener below.
    gantt.ext.zoom.init({ levels: ZOOM_LEVELS, activeLevelIndex: 1 });
    // Zooming also happens by ctrl+wheel, so the status bar cannot rely on its
    // own buttons to know which scale is showing.
    const zoomHandler = gantt.ext.zoom.attachEvent('onAfterZoom', (_level, config) => {
      scaleChangeRef.current?.(SCALE_LABELS[config.name ?? ''] ?? '');
      // The room a name needs is a number of pixels, and how many of them the
      // pinned range is worth is what a change of scale changes. No recursion
      // to guard against: the event comes from the extension, which `render`
      // never goes through.
      repinRangeToScale(solvedRef.current.schedule);
    });
    gantt.init(container);
    // Right after init, `config.grid_width` still agrees with `$grid` exactly
    // as it was just computed — the one moment the gap between them is known
    // good, before any divider drag this app cannot see could move it.
    gridWidthGapRef.current = gantt.config.grid_width - gantt.$grid.offsetWidth;

    /**
     * What a bar says when the pointer rests on it.
     *
     * Read off the plan on screen by id rather than out of the hovered element,
     * so smart rendering is irrelevant: the bar has to exist to be hovered, and
     * nothing here is stored on it to be lost at the next redraw. The extension
     * delegates one mousemove on `$root`, which outlives every redraw too.
     */
    const barTooltip = (id: string | null): string | undefined => {
      if (suppressTooltipRef.current) return undefined;
      const project = projectRef.current;
      const task = project.tasks.find((candidate) => candidate.id === id);
      const scheduled = id === null ? undefined : solvedRef.current.schedule.tasks.get(id);
      if (!task || !scheduled) return undefined;
      return renderBarTooltip({
        ...barFactsOf(
          task,
          scheduled,
          solvedRef.current,
          project.resources,
          chainRef.current,
          subtreeOf(project.tasks, task.id).size - 1,
        ),
        hiddenLinks: hiddenLinksOf(task.id),
      });
    };
    // The extension's own tooltip covers everything carrying a task id, the grid
    // rows included — where the columns already say all of this and the avatars
    // carry native titles that would fight it. Replaced by one on the bars.
    gantt.ext.tooltips.detach(`[${gantt.config.task_attribute}]:not(.gantt_task_row)`);
    gantt.ext.tooltips.tooltipFor({
      selector: '.gantt_task_line',
      html: (_event, node) => barTooltip(node.getAttribute(gantt.config.task_attribute)),
    });

    const overlays = mountOverlays();
    placeTodayLine(overlays);
    paintBands(overlays, projectRef.current, solvedRef.current);

    /**
     * The lanes under the chart, on the chart's own axis.
     *
     * Its own DOM below the container rather than a layer inside it: dhtmlx
     * sizes the data area to the rows and scrolls its contents, so lanes put in
     * there would either scroll away with the rows or be rewritten on the next
     * render. The alignment is bought back by taking every x from
     * `posFromDate` and following the chart's horizontal scroll.
     */
    const paintLoad = () => {
      const panel = loadHost.current;
      if (!panel) return;
      panel.hidden = !showLoadRef.current;
      if (!showLoadRef.current) {
        // Nothing to keep alive while the panel is closed, listeners included.
        panel.replaceChildren();
        return;
      }
      const { max_date: to } = gantt.getState();
      if (!(to instanceof Date)) return;
      const solved = solvedRef.current;
      if (lanesRef.current?.solved !== solved) {
        lanesRef.current = { solved, lanes: loadLanes(projectRef.current, solved) };
      }
      const names = new Map(projectRef.current.tasks.map((task) => [task.id, task.name]));
      renderLoadPanel(panel, lanesRef.current.lanes, {
        // Read every time: the grid can be resized by dragging its edge, and a
        // lane starting anywhere else than the bars do is worse than no lane.
        //
        // Measured, not the grid's width: two borders sit between the two, the
        // layout root's own left border and the grid cell's right one, so the
        // grid alone falls two pixels short of the timeline. `$task` and not
        // `$task_data`, which dhtmlx slides by the scroll offset (`dateUnder`
        // below) — `appliedScrollX` carries that instead, off the same pair.
        timelineOffset: gantt.$task.getBoundingClientRect().left - gantt.$root.getBoundingClientRect().left,
        timelineWidth: gantt.posFromDate(to),
        scrollX: appliedScrollX(),
        posOf: (date) => gantt.posFromDate(date),
        nonWorking: nonWorkingSpans(solvedRef.current.calendar),
        nameOf: (id) => names.get(id) ?? id,
      });
    };
    repaintLoadRef.current = paintLoad;
    paintLoad();

    /**
     * Whether the project has the person a row names.
     *
     * Everything that writes `resource_id` today picks from the project's own
     * people — the grid's select, the details dialog, and `applySolution`
     * mirroring the model back onto every row — so nothing live can fail this.
     * It is the net for the day that stops being true: an id from outside
     * reaches `schedule()` as work for somebody with no capacity, which throws
     * "Scheduler stalled" from inside the dhtmlx handler applying the edit.
     * Nothing catches it there, and the damage is silent rather than loud —
     * the chart stays on screen while the model keeps the bad id and stops
     * taking edits, which is why the guard is here and not a visible refusal.
     */
    const knownResource = (id: string) =>
      projectRef.current.resources.some((resource) => resource.id === id);

    const pullFromView = (id: string | number) => {
      const ganttTask = gantt.getTask(id);
      const task = projectRef.current.tasks.find((candidate) => candidate.id === String(id));
      if (!task) return;
      task.name = String(ganttTask.text ?? task.name);
      // Absent rather than zero, so a rename does not add a key the task never
      // had — see `updateTask`, which reads the same value from the dialog.
      task.progress = Number(ganttTask.progress) || undefined;
      // Subtasks display an inherited colour; writing it back would freeze a copy
      // that stops following the parent.
      if (task.parentId === undefined) {
        task.color = (ganttTask.own_color as string | undefined) || undefined;
      }
      // Effort, start and resource of a summary are rolled up from its children,
      // so writing them back would overwrite the user's leaf data with derived
      // figures the moment dhtmlx refreshes the parent row.
      if (solvedRef.current.summaryIds.has(task.id)) return;
      // Only a start the drag actually moved is a constraint — see
      // `constraintStart`. dhtmlx reports one drag twice, and the second report
      // arrives after the solved start has been written onto the row, so
      // reading it back unconditionally would move the constraint on its own
      // and cost a second, invisible undo step.
      const offered = new Date(ganttTask.start_date as Date);
      if (task.fixedEnd) {
        const scheduled = solvedRef.current.schedule.tasks.get(task.id);
        const end = new Date(ganttTask.end_date as Date);
        // Both ends off the solved ones is the bar carried whole; one is an
        // edge dragged. The row is the only witness: dhtmlx reports the update
        // before it says which drag it was. The second report finds the row
        // on the solved dates, and writes the days it already has.
        if (
          scheduled &&
          offered.getTime() !== scheduled.start.getTime() &&
          end.getTime() !== scheduled.end.getTime()
        ) {
          Object.assign(
            task,
            moveFixed(task, offered, solvedRef.current, projectRef.current.calendar),
          );
        } else {
          const { calendar } = solvedRef.current;
          task.start = calendar.startOfWorkingDay(offered);
          task.fixedEnd = fixedEndOn(calendar, task.start, end);
        }
      } else {
        task.start = constraintStart(task, offered, solvedRef.current);
      }
      const assigned = (ganttTask.resource_id as string | undefined) || undefined;
      // An id the project does not have leaves the assignment as it was rather
      // than clearing it: unhooking somebody's work in silence is what
      // `releasedBy` exists to avoid. The row comes back into line by itself,
      // since applySolution writes `resource_id` from the model every solve.
      if (assigned === undefined || knownResource(assigned)) task.resourceId = assigned;
      const nominal = Number(ganttTask.nominal_days);
      if (isValidEffort(nominal)) task.nominalDays = nominal;
    };

    /**
     * Writes the grid's row order back onto the model.
     *
     * Walked with `getChildren` rather than `eachTask`, which is an iteration
     * over what is on screen: a branch the user closed must keep the order it
     * has inside it, not be flattened out of the file for being folded.
     */
    const pullOrderFromView = () => {
      const walk = (parent: string | number): string[] =>
        gantt.getChildren(parent).flatMap((id) => [String(id), ...walk(id)]);
      projectRef.current.tasks = reorderTasks(
        projectRef.current.tasks,
        walk(gantt.config.root_id),
      );
    };

    const syncLinks = () => {
      const byTarget = new Map<string, string[]>();
      gantt.getLinks().forEach((link) => {
        const target = String(link.target);
        const list = byTarget.get(target);
        if (list) list.push(String(link.source));
        else byTarget.set(target, [String(link.source)]);
      });
      for (const task of projectRef.current.tasks) {
        task.predecessors = byTarget.get(task.id) ?? [];
      }
    };

    // On a summary these columns show rolled-up figures, so an editor would
    // accept a value the rollup then discards — and one of them would not even
    // show the figure the cell does: the column templates roll up, the editor
    // reads the raw field, so a summary whose children sum to five days offers
    // its own untouched one.
    //
    // Refused here rather than at the gesture that opened it. Every way in ends
    // at `startEdit`, and there are four: dhtmlx's own click, Tab arriving from
    // the cell before, a script, and the double click on a name. A guard on any
    // one of them is a guard the other three walk past.
    //
    // The name is the exception that proves it: a single click on it selects
    // the row, so dhtmlx's click is refused for `text` alone while a click is in
    // flight (`clickInFlight`), and `renameOnDoubleClick` opens it instead.
    let clickInFlight = false;
    const derivedGuard = gantt.ext.inlineEditors.attachEvent(
      'onBeforeEditStart',
      (state) =>
        !(state.columnName === 'text' && clickInFlight) &&
        !(solvedRef.current.summaryIds.has(String(state.id)) &&
          DERIVED_ON_SUMMARY.has(state.columnName)) &&
        // On a fixed task the cell shows the work that went in, which is derived.
        !(state.columnName === 'nominal_days' && gantt.getTask(state.id).fixed),
    );

    // dhtmlx's own inline-editor keydown handler (bundled, live without the
    // keyboard_navigation extension this chart deliberately does not load, to
    // keep the arrows and Del for App) already answers Tab and Enter on a real
    // keyCode, and calls preventDefault(). This handler exists for the
    // keystroke that one cannot see: a hand-rolled keydown carrying
    // `keyCode: 0`, which is how an agent drives this grid and which the
    // vendor's own key check never recognises. Standing down on
    // `event.defaultPrevented` leaves a real key to the vendor's single move
    // and a synthetic one to this handler alone — without the guard, both run
    // on a real key and one Tab moves two cells.
    const editorKeys = (event: KeyboardEvent) => {
      const editors = gantt.ext.inlineEditors;
      if (!editors.isVisible() || event.defaultPrevented) return;
      if (event.key === 'Tab') {
        event.preventDefault();
        // Past the last editable cell of a row and on to the first of the next,
        // which is the one thing a grid of cells is always expected to do.
        if (event.shiftKey) editors.editPrevCell(true);
        else editors.editNextCell(true);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        editors.save();
      }
      // Escape is dhtmlx's own and already closes without saving.
    };
    container.addEventListener('keydown', editorKeys);

    /**
     * The day the pointer is over, for an anchor that is on the timeline.
     *
     * The date axis is the one thing the timeline has and the grid has not, so
     * pointing at a week there says a start out loud — while a grid row says
     * only which row, and the caller falls back to that row's own day.
     *
     * Measured against `$task_data`, and **without** adding the scroll: that
     * element is the one the chart translates, so its own rect has already
     * moved by however far the timeline is scrolled — adding `getScrollState().x`
     * counts it twice and lands the task a fortnight out. The load lanes do add
     * it, and are not a precedent: they are drawn in a panel of their own that
     * does not move with the chart.
     *
     * `startOfWorkingDay` then takes the arbitrary minute off it, as it does for
     * a drop.
     */
    const dateUnder = (anchor: Element, clientX: number): Date | undefined => {
      const onTimeline =
        anchor.classList.contains('gantt_task_line') ||
        anchor.classList.contains('gantt_task_row');
      if (!onTimeline) return undefined;
      const left = gantt.$task_data.getBoundingClientRect().left;
      return gantt.dateFromPos(clientX - left) ?? undefined;
    };

    // The only pointer gesture either half of the chart had left: a click
    // selects the row (and opens the cell's editor, the name's on a double
    // click), a drag reorders in the grid and moves the bar in the timeline. The
    // row is selected too, so the plan says which one the menu is about even
    // after the pointer has moved off it.
    //
    // Three anchors, one menu: a grid row, a bar, and the empty stretch of a
    // bar's own lane — which resolves to the `.gantt_task_row` behind it, the
    // bars being drawn in a layer of their own above it.
    const openRowMenu = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.(
        '.gantt_grid_data .gantt_row, .gantt_task_line, .gantt_task_row',
      );
      const id = anchor?.getAttribute('data-task-id');
      if (!anchor || !id || !gantt.isTaskExists(id)) return;
      event.preventDefault();
      gantt.selectTask(id);
      const task = projectRef.current.tasks.find((candidate) => candidate.id === id);
      rowMenuRef.current?.({
        taskId: id,
        name: String(gantt.getTask(id).text ?? ''),
        x: event.clientX,
        y: event.clientY,
        isSummary: solvedRef.current.summaryIds.has(id),
        isMilestone: task !== undefined && isMilestone(task, solvedRef.current.summaryIds),
        start: dateUnder(anchor, event.clientX),
        disabled: task?.disabled === true,
      });
    };
    container.addEventListener('contextmenu', openRowMenu);

    // The row's hover buttons, claimed on the capture phase: a press there must
    // not select, rename or drag the row under them.
    const rowAction = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('[data-grid-add]')) {
        event.stopPropagation();
        if (event.type === 'click') addTaskRef.current?.();
        return;
      }
      const button = target?.closest?.<HTMLElement>('[data-row-action]');
      if (!button) return;
      event.stopPropagation();
      if (event.type !== 'click') return;
      const id = button.closest('.gantt_row')?.getAttribute('data-task-id');
      if (!id || !gantt.isTaskExists(id)) return;
      const action = button.dataset.rowAction;
      if (action === 'info') openTaskRef.current?.(id);
      else if (action === 'disable') {
        const task = projectRef.current.tasks.find((candidate) => candidate.id === id);
        toggleDisabledRef.current?.(id, task?.disabled === true);
      } else if (action === 'child') gantt.createTask(undefined, id);
      else if (action === 'remove') deleteTaskRef.current?.(id);
    };
    for (const type of ['pointerdown', 'mousedown', 'click', 'dblclick'] as const) {
      container.addEventListener(type, rowAction, true);
    }

    // A click on a grid cell opens an inline editor but leaves the row
    // unselected, so Del would have nothing to act on unless the user went to
    // the timeline to click a bar first.
    const selectRow = (event: MouseEvent) => {
      clickInFlight = false;
      const target = event.target as HTMLElement | null;
      const id = target?.closest?.('.gantt_row')?.getAttribute('data-task-id');
      if (id && gantt.isTaskExists(id)) gantt.selectTask(id);
    };
    // Bubble phase, unlike the editor above: selecting re-renders the row, and
    // dhtmlx dispatches its own delegated click handlers only while the clicked
    // node is still a descendant of the grid. Selecting on the capture phase
    // detaches it first, which swallows the click on the expand/collapse icon
    // and on the "+" button of any row that is not already selected. dhtmlx
    // delegates on $grid, inside this container, so bubble gets there second.
    container.addEventListener('click', selectRow);

    // Set above dhtmlx's delegation root, cleared below it by `selectRow`; the
    // timeout covers a click a capture-phase closer (RowMenu, ColumnPicker) stops.
    const markClickInFlight = () => {
      clickInFlight = true;
      setTimeout(() => (clickInFlight = false));
    };
    container.addEventListener('click', markClickInFlight, true);

    // Read above dhtmlx's delegation root, before it toggles and redraws; run
    // below it, after `selectRow` has redrawn the row too, in the same task, so
    // the fold starts on the very frame that first shows the new tree.
    let pendingFold: (() => void) | null = null;
    const slideOnToggle = (event: MouseEvent) => {
      pendingFold = null;
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.('.gantt_tree_icon.gantt_open, .gantt_tree_icon.gantt_close')) return;
      const id = target.closest('.gantt_row')?.getAttribute('data-task-id');
      if (id && gantt.isTaskExists(id)) pendingFold = foldRows(id);
    };
    container.addEventListener('click', slideOnToggle, true);
    const runFold = () => {
      pendingFold?.();
      pendingFold = null;
    };
    container.addEventListener('click', runFold);

    const renameOnDoubleClick = (event: MouseEvent) => {
      const editors = gantt.ext.inlineEditors;
      const cell = editors.locateCell(event.target as HTMLElement) as
        | { id: string | number; columnName: string }
        | null;
      if (cell?.columnName !== 'text' || editors.isVisible()) return;
      editors.startEdit(cell.id, 'text');
    };
    container.addEventListener('dblclick', renameOnDoubleClick);

    // Del on the selected row, on the document rather than the container: with
    // keyboard navigation dhtmlx moves focus around its own cells, and a key
    // that only works when focus happens to sit inside the chart reads as
    // broken.
    const dragTip = document.createElement('div');
    dragTip.className = 'pace-tip drag-tip';
    dragTip.hidden = true;
    document.body.appendChild(dragTip);
    // A drag dhtmlx abandons ends without `onAfterTaskDrag`.
    const hideDragTip = () => (dragTip.hidden = true);
    document.addEventListener('pointerup', hideDragTip);

    const deleteSelected = (event: KeyboardEvent) => {
      if (event.key !== 'Delete') return;
      if (keystrokeIsCaptured()) return;
      const selected = gantt.getSelectedId();
      if (!selected || !gantt.isTaskExists(selected)) return;
      event.preventDefault();
      deleteTaskRef.current?.(String(selected));
    };
    document.addEventListener('keydown', deleteSelected);

    const handlers = [
      gantt.attachEvent('onGanttRender', () => {
        placeTodayLine(overlays);
        paintBands(overlays, projectRef.current, solvedRef.current);
        paintLoad();
        return true;
      }, undefined),
      // onGanttRender alone leaves the line and the bands a render behind:
      // refreshData sizes the rows after it, and adding a task goes through
      // refreshData.
      gantt.attachEvent('onDataRender', () => {
        placeTodayLine(overlays);
        paintBands(overlays, projectRef.current, solvedRef.current);
        paintLoad();
        return true;
      }, undefined),
      // The lanes are as wide as the whole timeline and are moved rather than
      // redrawn, so following the chart costs nothing per scrolled pixel.
      //
      // Measured off `$task`/`$task_data` (`appliedScrollX`) and deliberately
      // not from the event's own `left`: this fires several times per scroll —
      // how many depends on the gesture — and some of those carry the position
      // the chart has just left rather than the one it reached, so a lane
      // driven by the argument settles wherever the last stale report happened
      // to land. A fresh measurement is right in every firing. This is also
      // the only site a horizontal scroll reaches: it re-renders nothing, so
      // `paintLoad`'s geometry is never re-evaluated on the way through.
      gantt.attachEvent('onGanttScroll', () => {
        if (loadHost.current) scrollLoadPanel(loadHost.current, appliedScrollX());
      }, undefined),
      gantt.attachEvent('onTaskClick', (_id, event) => {
        const target = event?.target as HTMLElement | null;
        // The empty stretch of a task's lane is outside the task.
        if (target?.closest?.('[data-task-id], [task_id]')?.classList.contains('gantt_task_row')) {
          gantt.unselectTask();
          return false;
        }
        return true;
      }, undefined),
      gantt.attachEvent('onTaskSelected', (id) => {
        selectionRef.current?.(String(id));
        return true;
      }, undefined),
      gantt.attachEvent('onTaskUnselected', () => {
        // A new selection unselects the old one first, and only then sets
        // itself: read what is left once dhtmlx is done.
        queueMicrotask(() => {
          const selected = gantt.getSelectedId();
          if (!selected || !gantt.isTaskExists(selected)) selectionRef.current?.(null);
        });
        return true;
      }, undefined),
      gantt.attachEvent('onEmptyClick', () => {
        gantt.unselectTask();
        return true;
      }, undefined),
      // Rows created by dhtmlx itself — `createTask`, behind the row's "+", which adds a
      // child — never passed through the model, so they rendered with an
      // undefined effort and a NaN duration.
      gantt.attachEvent('onAfterTaskAdd', (id, item) => {
        if (applyingRef.current) return true;
        const key = String(id);
        if (!projectRef.current.tasks.some((task) => task.id === key)) {
          const parent = item.parent !== undefined && String(item.parent) !== '0'
            ? String(item.parent)
            : undefined;
          const start = solvedRef.current.calendar.startOfWorkingDay(
            item.start_date ? new Date(item.start_date as Date) : new Date(),
          );
          // Honour whatever the caller supplied and only fall back to a day of
          // effort, so a row created with data does not silently lose it.
          const supplied = Number(item.nominal_days);
          const assigned = (item.resource_id as string | undefined) || undefined;
          projectRef.current.tasks.push({
            id: key,
            name: String(item.text || 'New task'),
            nominalDays: isValidEffort(supplied) ? supplied : 1,
            start,
            parentId: parent,
            // Same net as `pullFromView`'s, with nothing to fall back on: a row
            // that did not exist a moment ago has no earlier assignment to keep.
            resourceId: assigned !== undefined && knownResource(assigned) ? assigned : undefined,
            // Only a top-level task owns a colour; a subtask inherits its
            // parent's, and a copy frozen here would stop following it.
            color: parent ? undefined : (item.own_color as string | undefined) || undefined,
            // Never stored as false — see updateTask's own comment.
            disabled: item.disabled === true ? true : undefined,
          });
        }
        // Pushed at the end of the list, while the grid put it next to its
        // siblings — which for a child of anything but the last branch is a
        // different place.
        pullOrderFromView();
        applySolution();
        return true;
      }, undefined),
      // Refused before the move for the reason a link is: onAfterTaskMove writes
      // the parent into the model and re-solves, and a parent's dependencies are
      // inherited — a move can close a cycle no link ever drew.
      gantt.attachEvent('onBeforeTaskMove', (id, parent) => {
        if (applyingRef.current) return true;
        const problem = rejectionForParent(
          projectRef.current,
          String(id),
          parent !== undefined && String(parent) !== '0' ? String(parent) : null,
        );
        if (!problem) return true;
        rejectRef.current?.(problem);
        return false;
      }, undefined),
      gantt.attachEvent('onAfterTaskMove', (id, parent) => {
        if (applyingRef.current) return true;
        const task = projectRef.current.tasks.find((candidate) => candidate.id === String(id));
        if (task) {
          task.parentId = parent !== undefined && String(parent) !== '0' ? String(parent) : undefined;
        }
        // A move is a reorder as much as a re-parent: dropping a row between two
        // of its own siblings changes nothing else at all.
        pullOrderFromView();
        applySolution();
        return true;
      }, undefined),
      gantt.attachEvent('onAfterTaskUpdate', (id) => {
        if (applyingRef.current) return true;
        pullFromView(id);
        applySolution();
        return true;
      }, undefined),
      gantt.attachEvent(
        'onBeforeTaskDrag',
        (id, mode) => mode !== gantt.config.drag_mode.resize || Boolean(gantt.getTask(id).fixed),
        undefined,
      ),
      // Says what the drop will write while the bar is in the air.
      gantt.attachEvent('onTaskDrag', (id, mode, ganttTask) => {
        const task = projectRef.current.tasks.find((candidate) => candidate.id === String(id));
        const summary = solvedRef.current.summaryIds.has(String(id));
        if (!task || summary || mode === gantt.config.drag_mode.progress) return true;
        const drop = dropDates(
          task,
          mode === gantt.config.drag_mode.resize,
          new Date(ganttTask.start_date as Date),
          new Date(ganttTask.end_date as Date),
          solvedRef.current,
          projectRef.current.calendar,
        );
        dragTip.textContent = drop.end
          ? `${formatDay(drop.start)} → ${formatDay(drop.end)}, ${formatDays(drop.days!)}d`
          : `Starting ${formatDay(drop.start)}`;
        // From the dates, not the bar's node: dhtmlx moves the node after this event.
        const bar = gantt.getTaskPosition(ganttTask, ganttTask.start_date, ganttTask.end_date);
        // Data to screen: `$task_data` follows a horizontal scroll but scrolls its
        // rows itself, by `scrollTop` (docs/dhtmlx.md).
        const origin = gantt.$task_data.getBoundingClientRect();
        // Over the part of the bar on screen: a long bar's middle can be far off it.
        const view = gantt.$task.getBoundingClientRect();
        const from = Math.max(origin.left + bar.left, view.left);
        const to = Math.min(origin.left + bar.left + bar.width, view.right);
        dragTip.style.left = `${(from + to) / 2}px`;
        dragTip.style.top = `${origin.top + bar.top - gantt.$task_data.scrollTop - 22}px`;
        dragTip.hidden = false;
        return true;
      }, undefined),
      gantt.attachEvent('onAfterTaskDrag', (id) => {
        dragTip.hidden = true;
        if (applyingRef.current) return true;
        pullFromView(id);
        applySolution();
        return true;
      }, undefined),
      gantt.attachEvent('onAfterTaskDelete', (id) => {
        if (applyingRef.current) return true;
        const doomed = subtreeOf(projectRef.current.tasks, String(id));
        projectRef.current.tasks = projectRef.current.tasks.filter((task) => !doomed.has(task.id));
        for (const task of projectRef.current.tasks) {
          task.predecessors = task.predecessors?.filter(
            (predecessorId) => !doomed.has(predecessorId),
          );
        }
        applySolution();
        return true;
      }, undefined),
      // Refused here rather than after the fact, and for the same reason the
      // scripted path refuses: onAfterLinkAdd writes the predecessors into the
      // model before re-solving, so a cycle drawn with the mouse used to leave
      // the project holding a schedule it cannot solve and the chart half
      // updated, with nothing but an uncaught error to show for it.
      gantt.attachEvent('onBeforeLinkAdd', (_id, link) => {
        if (applyingRef.current) return true;
        // The type is a view concept — the scripted surface always passes FS
        // (addLink above) — and syncLinks reads every link as finish-to-start
        // source→target regardless of what was drawn, so a link dragged from
        // the left dot would schedule as something other than what it shows.
        if (String(link.type) !== String(gantt.config.links.finish_to_start)) {
          rejectRef.current?.(
            "Only finish-to-start dependencies: drag from the predecessor's right dot to the successor's left dot",
          );
          return false;
        }
        const problem = rejectionForLink(
          projectRef.current,
          String(link.source),
          String(link.target),
        );
        if (!problem) return true;
        rejectRef.current?.(problem);
        return false;
      }, undefined),
      gantt.attachEvent('onAfterLinkAdd', () => {
        if (applyingRef.current) return true;
        syncLinks();
        applySolution();
        return true;
      }, undefined),
      gantt.attachEvent('onAfterLinkDelete', () => {
        if (applyingRef.current) return true;
        syncLinks();
        applySolution();
        return true;
      }, undefined),
    ];

    const detachPaceHandles = installPaceHandles({
      container,
      project: () => projectRef.current,
      solved: () => solvedRef.current,
      // The one write that is not an edit: a drag shows each step re-solved,
      // and only its release — or nothing, on Escape — reaches `onChange`.
      // The drag hands back the lists it found, so nothing of this is left.
      preview: (periods) => {
        for (const task of projectRef.current.tasks) {
          if (!periods.has(task.id)) continue;
          const list = periods.get(task.id);
          if (list?.length) task.shareOverrides = list;
          else delete task.shareOverrides;
        }
        applySolution(false);
      },
      commit: (taskId, periods) => setPacePeriodsRef.current?.(taskId, periods),
      reject: (message) => rejectRef.current?.(message),
    });

    const detachLinkHover = installLinkHover(container);
    const detachBarActions = installBarActions(container, {
      describe: (taskId) => {
        const task = projectRef.current.tasks.find((candidate) => candidate.id === taskId);
        if (!task) return undefined;
        return {
          isSummary: solvedRef.current.summaryIds.has(taskId),
          isMilestone: isMilestone(task, solvedRef.current.summaryIds),
          fixed: Boolean(task.fixedEnd),
          disabled: task.disabled === true,
        };
      },
      info: (taskId) => openTaskRef.current?.(taskId),
      toggleAutoEnd: (taskId) => toggleAutoEndRef.current?.(taskId),
      toggleDisabled: (taskId, disabled) => toggleDisabledRef.current?.(taskId, disabled),
      remove: (taskId) => deleteTaskRef.current?.(taskId),
    });
    const detachRolledLinks = installRolledLinks(container);

    loadProject(projectRef.current);

    /**
     * Ctrl and the wheel change the scale, as they do in every other chart.
     *
     * `passive: false` and `preventDefault` are both load-bearing: without them
     * the browser zooms the page instead, which is the one gesture a user is
     * sure to try. A trackpad pinch arrives here as the same event with
     * `ctrlKey` set, so pinching zooms the timeline for free.
     *
     * Capture phase, and the propagation stopped: dhtmlx scrolls the chart on
     * the wheel from a handler on the data area, and when it does scroll it
     * consumes the event — so a listener on the bubble phase, like this one
     * was, only ever ran at the two ends of the vertical scroll, where dhtmlx
     * has nothing to scroll and lets the event through. Zooming in worked at
     * the top and zooming out at the bottom, and nothing worked in between.
     *
     * One step per gesture rather than per event: a flick of a wheel and a
     * pinch both fire in bursts, and the levels are few enough that a burst
     * would cross all of them and land on quarters.
     */
    let lastZoomStep = 0;
    const zoomOnWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      // Or dhtmlx scrolls the rows away under the scale that is being changed.
      event.stopPropagation();
      if (event.deltaY === 0) return;
      const now = event.timeStamp || Date.now();
      if (now - lastZoomStep < WHEEL_ZOOM_COOLDOWN) return;
      lastZoomStep = now;
      // The date under the pointer stays under it: the zoom is about where the
      // user is looking, not about the middle of the viewport.
      const viewport = gantt.$task.getBoundingClientRect();
      const overTimeline = event.clientX >= viewport.left && event.clientX <= viewport.right;
      const pointed = overTimeline
        ? gantt.dateFromPos(event.clientX - gantt.$task_data.getBoundingClientRect().left)
        : null;
      if (event.deltaY < 0) gantt.ext.zoom.zoomIn();
      else gantt.ext.zoom.zoomOut();
      if (pointed) {
        gantt.scrollTo(
          Math.max(0, gantt.posFromDate(pointed) - (event.clientX - viewport.left)),
          null,
        );
      }
    };
    container.addEventListener('wheel', zoomOnWheel, { passive: false, capture: true });

    // dhtmlx measures its container once at init. It listens for window resize,
    // but not for the container changing size on its own — a split pane
    // resizing, or a devtools panel opening.
    const observer = new ResizeObserver(() => gantt.setSizes());
    observer.observe(container);


    return () => {
      observer.disconnect();
      gantt.ext.tooltips.detach('.gantt_task_line');
      // The tooltip node lives on document.body, so an unmount while one is up
      // would leave it there with nothing to describe.
      gantt.ext.tooltips.tooltip.hide();
      overlays.detach();
      detachPaceHandles();
      detachLinkHover();
      detachBarActions();
      detachRolledLinks();
      gantt.ext.zoom.detachEvent(zoomHandler);
      container.removeEventListener('wheel', zoomOnWheel, true);
      container.removeEventListener('contextmenu', openRowMenu);
      for (const type of ['pointerdown', 'mousedown', 'click', 'dblclick'] as const) {
        container.removeEventListener(type, rowAction, true);
      }
      gantt.ext.inlineEditors.detachEvent(derivedGuard);
      container.removeEventListener('keydown', editorKeys);
      container.removeEventListener('click', selectRow);
      container.removeEventListener('click', markClickInFlight, true);
      container.removeEventListener('dblclick', renameOnDoubleClick);
      container.removeEventListener('click', slideOnToggle, true);
      container.removeEventListener('click', runFold);
      document.removeEventListener('keydown', deleteSelected);
      document.removeEventListener('pointerup', hideDragTip);
      dragTip.remove();
      handlers.forEach((handlerId) => gantt.detachEvent(handlerId));
      // Deliberately no destructor(): it leaves the singleton unusable, and
      // StrictMode's mount/unmount/mount would then re-init a dead instance
      // ("cannot read tasksStore"). The Community build has no
      // getGanttInstance(), so there is exactly one gantt for the whole app.
      gantt.clearAll();
    };
  }, [applySolution, loadProject]);

  // Declared after the effect that inits the chart, so the first run has rows to
  // write to — and it compares against the ref rather than firing on mount,
  // since the first parse already drew whatever this asks for. Going through
  // applySolution keeps one path onto the rows; `false` because turning the
  // marking on is a view switch and must not mark the file dirty.
  useEffect(() => {
    if (markCriticalRef.current === markCritical) return;
    markCriticalRef.current = markCritical;
    applySolution(false);
  }, [applySolution, markCritical]);

  // A view switch like the one above, and cheaper: the panel is drawn from the
  // schedule that is already solved, so opening it costs an aggregation and a
  // paint rather than a re-solve — and never marks the file dirty.
  useEffect(() => {
    showLoadRef.current = showLoad;
    repaintLoadRef.current();
    // The chart has just gained or lost the strip's height, and dhtmlx measures
    // its container at init and on a window resize only. Without this its
    // horizontal scrollbar stays where the taller layout put it, behind the
    // panel — the chart looks right and cannot be scrolled sideways any more.
    gantt.setSizes();
  }, [showLoad]);

  // A stylesheet rule rather than a class written onto the rows: dhtmlx rebuilds
  // them on every redraw and would drop it, and redrawing on hover would replace
  // the very node the pointer is on. How faint the rest of the plan goes is the
  // stylesheet's business, which is why the rule reads a custom property.
  useEffect(() => {
    if (!highlighted) return;
    // Nothing is spared, the selected row included: one row left bright in
    // somebody else's colour reads as part of the highlight.
    const others = `:not(.${resourceClass(highlighted)})`;
    const rule = document.createElement('style');
    rule.textContent =
      `.gantt-host .gantt_row${others},` +
      `.gantt-host .gantt_task_line${others},` +
      `.gantt-host .gantt_task_link${others},` +
      // The load panel is not inside the chart, so it needs a selector of its
      // own — and it is the view arranged by person, where dimming the others
      // is most of the point.
      `.loadlane${others}` +
      `{opacity:var(--gantt-dimmed)}`;
    document.head.appendChild(rule);
    return () => rule.remove();
  }, [highlighted]);

  return (
    <>
      <div ref={host} className="gantt-host" />
      {/* Painted imperatively, like the today line and the bands: it follows
          dhtmlx's geometry and has to be redrawn from the same events. */}
      <div ref={loadHost} className="loadpanel" hidden />
    </>
  );
}
