import { gantt } from 'dhtmlx-gantt';
import { X } from 'lucide-static';
import { dateOfDay, dayIndexOf, dayStringOf, type ShareOverride } from '../scheduler';
import {
  addPeriod,
  levelShare,
  moveEdge,
  nearestMidnight,
  periodBoxes,
  removePeriod,
  samePeriods,
  setLevel,
  shareLabel,
  type PeriodBox,
} from './pacePeriods';
import { isMilestone, type Project, type ProjectTask, type SolvedProject } from './project';
import { parseTaskShare, seedShare, taskDays, type TaskDays } from './taskShare';

/**
 * A task's pace periods, set and adjusted on its bar: the DOM and dhtmlx half.
 * What a gesture means is `pacePeriods.ts`; what it writes goes out through
 * `commit`, the path the dialog's Save takes.
 */
interface Options {
  container: HTMLElement;
  project(): Project;
  solved(): SolvedProject;
  /**
   * Shows each task named with the periods given while a drag is under way:
   * the plan is re-solved and redrawn, and nobody is told — no undo step, no
   * draft. The model then holds them as that solve trimmed them to their
   * tasks. `undefined` is a task with none.
   */
  preview(periods: PeriodsByTask): void;
  /** The edit itself: one undo step. */
  commit(taskId: string, periods: ShareOverride[]): void;
  reject(message: string): void;
}

type PeriodsByTask = ReadonlyMap<string, ShareOverride[] | undefined>;

type DragPart = 'from' | 'to' | 'level';

interface Drag {
  taskId: string;
  index: number;
  part: DragPart;
  /** The model's own list at the press, which Escape puts back as it was. */
  original: ShareOverride[] | undefined;
  /**
   * Every task's list at the press. Each preview starts from these: the solve
   * behind it trims whatever task it shortens, the dragged one or another on
   * the same person, and the next move may lengthen that task again.
   */
  atPress: PeriodsByTask;
  /** The last list previewed, as the gesture made it: before the trim to the task. */
  shown: ShareOverride[];
  previewed: boolean;
  startY: number;
  startShare: number;
  barHeight: number;
}

const PARTS =
  `<div class="pace-edge pace-edge--from" data-pace-part="from"></div>` +
  `<div class="pace-edge pace-edge--to" data-pace-part="to"></div>` +
  `<div class="pace-level" data-pace-part="level"></div>` +
  `<div class="pace-x" data-pace-part="delete" title="Remove this period">${X}</div>`;

/** On the bar of the task under the pointer: what brings its percent labels up (gantt.css). */
const HOT_BAR_CLASS = 'gantt-bar--hot';

const dayX = (day: number) => gantt.posFromDate(dateOfDay(day));

/** `$task_data` already moves with the scroll: no offset to add (docs/dhtmlx.md). */
const dateUnder = (event: MouseEvent): Date | null =>
  gantt.dateFromPos(event.clientX - gantt.$task_data.getBoundingClientRect().left) ?? null;

export function installPaceHandles(options: Options): () => void {
  const { container } = options;

  // A layer of our own over the bars, not markup inside them: dhtmlx replaces
  // a bar's node on every refresh and on selection, and a handle that vanishes
  // under the pointer ends its own drag.
  const layer = document.createElement('div');
  layer.className = 'pace-layer';
  gantt.$task_data.appendChild(layer);
  const nodes = new Map<string, HTMLElement>();

  const tip = document.createElement('div');
  tip.className = 'pace-tip';
  tip.hidden = true;
  document.body.appendChild(tip);

  let drag: Drag | null = null;
  let hotTask: string | null = null;
  let swallowClick = false;

  const isPaceable = (task: ProjectTask) => {
    const { summaryIds } = options.solved();
    return !summaryIds.has(task.id) && !isMilestone(task, summaryIds);
  };

  const paceable = (taskId: string | null | undefined) => {
    const task = options.project().tasks.find((candidate) => candidate.id === taskId);
    return task && isPaceable(task) ? task : undefined;
  };

  /** The task's working days as the plan on screen counts them. */
  const daysOf = (taskId: string): TaskDays | undefined => {
    const solved = options.solved();
    const scheduled = solved.schedule.tasks.get(taskId);
    return scheduled && taskDays(scheduled, solved.calendar);
  };

  /** The period under the drag as the gesture last made it; none once an edge passed the other. */
  const draggedPeriod = (current: Drag): ShareOverride | undefined =>
    current.shown.length === (current.original ?? []).length
      ? current.shown[current.index]
      : undefined;

  const classOf = (taskId: string, box: PeriodBox, dragging: boolean) =>
    'pace-period' +
    (box.tiny ? ' pace-period--tiny' : '') +
    (taskId === hotTask ? ' pace-period--hot' : '') +
    (dragging ? ' pace-period--dragging' : '');

  /** The bar is dhtmlx's node, replaced on every refresh: marked again on each paint. */
  const markHotBar = () => {
    for (const bar of container.querySelectorAll(`.${HOT_BAR_CLASS}`)) {
      bar.classList.remove(HOT_BAR_CLASS);
    }
    // No node while the bar is scrolled out of the rendered range.
    if (hotTask && gantt.isTaskExists(hotTask)) {
      gantt.getTaskNode(hotTask)?.classList.add(HOT_BAR_CLASS);
    }
  };

  const paint = () => {
    markHotBar();
    const { min_date: from, max_date: to } = gantt.getState();
    const live = new Set<string>();
    if (from instanceof Date && to instanceof Date) {
      const rendered = { firstDay: dayIndexOf(from), endDay: dayIndexOf(to) };
      for (const task of options.project().tasks) {
        if (!task.shareOverrides || !isPaceable(task)) continue;
        // A row inside a closed branch has no place on the chart.
        if (!gantt.isTaskExists(task.id) || !gantt.isTaskVisible(task.id)) continue;
        const days = daysOf(task.id);
        if (!days) continue;
        const bar = gantt.getTaskPosition(gantt.getTask(task.id));
        const boxes = periodBoxes(
          task.shareOverrides,
          rendered,
          { top: bar.top, height: bar.height, rowHeight: bar.rowHeight ?? bar.height },
          dayX,
          days.dayOf,
        );
        // By its first day, which a trim never moves: the model's list can be
        // shorter than the gesture's, and a position would name another period.
        const draggedFrom = drag?.taskId === task.id ? draggedPeriod(drag)?.fromDay : undefined;
        for (const box of boxes) {
          const key = `${task.id}:${box.index}`;
          live.add(key);
          let node = nodes.get(key);
          // Reused by key, so the handle under the pointer outlives the redraws
          // its own drag causes.
          if (!node) {
            node = document.createElement('div');
            node.innerHTML = PARTS;
            layer.appendChild(node);
            nodes.set(key, node);
          }
          node.dataset.paceTask = task.id;
          node.dataset.paceIndex = String(box.index);
          node.className = classOf(
            task.id,
            box,
            task.shareOverrides[box.index].fromDay === draggedFrom,
          );
          // Day columns run midnight to midnight, the bar from the opening of
          // its first day to the close of its last: without the clamp a period
          // on either end sticks out of its task.
          const left = Math.max(box.left, bar.left);
          const right = Math.min(box.left + box.width, bar.left + bar.width);
          node.style.left = `${left}px`;
          node.style.top = `${box.top}px`;
          node.style.width = `${Math.max(0, right - left)}px`;
          node.style.height = `${box.height}px`;
          // The period's share of the person, not the rate the bar draws.
          (node.querySelector('.pace-level') as HTMLElement).style.top =
            `${((1 - box.share) * 100).toFixed(1)}%`;
        }
      }
    }
    for (const [key, node] of nodes) {
      if (live.has(key)) continue;
      node.remove();
      nodes.delete(key);
    }
  };

  /** Validated by the gate the dialog and the file use, then handed over. */
  const commit = (taskId: string, periods: ShareOverride[], ended?: Drag) => {
    let parsed: ShareOverride[];
    try {
      parsed = parseTaskShare(undefined, periods).shareOverrides ?? [];
    } catch (problem) {
      if (ended) restore(ended);
      options.reject((problem as Error).message);
      return;
    }
    options.commit(taskId, parsed);
  };

  /** The list the drag stands for at this pointer position, always from the original. */
  const candidate = (current: Drag, event: MouseEvent): ShareOverride[] => {
    const base = current.original ?? [];
    if (current.part === 'level') {
      const share = levelShare(current.startShare, current.startY - event.clientY, current.barHeight);
      return setLevel(base, current.index, share);
    }
    const date = dateUnder(event);
    const days = daysOf(current.taskId);
    if (!date || !days) return current.shown;
    // The first working day past the midnight the edge is dropped on opens the
    // period; the one before it closes it.
    const opening = days.ordinalFrom(nearestMidnight(date));
    const day = current.part === 'from' ? opening : opening - 1;
    return moveEdge(base, current.index, current.part, day);
  };

  const showTip = (event: MouseEvent, current: Drag) => {
    // As it stands on the task: the solve behind the preview may have cut it
    // back to the task's end, or left none of it.
    const dragged = draggedPeriod(current);
    const period =
      dragged &&
      paceable(current.taskId)?.shareOverrides?.find(
        (candidate) => candidate.fromDay === dragged.fromDay,
      );
    const days = daysOf(current.taskId);
    const date = (ordinal: number) => dayStringOf(days!.dayOf(ordinal));
    tip.hidden = false;
    tip.textContent =
      period && days
        ? `${date(period.fromDay)} → ${date(period.toDay)} · ${shareLabel(period.share)}`
        : 'Release to remove';
    tip.style.left = `${event.clientX + 14}px`;
    tip.style.top = `${event.clientY - 30}px`;
  };

  const endDrag = () => {
    drag = null;
    tip.hidden = true;
    document.body.classList.remove('pace-dragging-x', 'pace-dragging-y');
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onUp, true);
    window.removeEventListener('keydown', onKey, true);
  };

  function onMove(event: MouseEvent) {
    if (!drag) return;
    event.stopPropagation();
    const next = candidate(drag, event);
    if (!samePeriods(next, drag.shown)) {
      drag.shown = next;
      drag.previewed = true;
      options.preview(new Map(drag.atPress).set(drag.taskId, next));
    }
    showTip(event, drag);
  }

  /** Puts the model back exactly as the press found it. */
  function restore(ended: Drag) {
    if (ended.previewed) options.preview(ended.atPress);
    else paint();
  }

  function onUp(event: MouseEvent) {
    if (!drag) return;
    event.stopPropagation();
    const ended = drag;
    endDrag();
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 0);
    // What is on screen is what is kept: the model's list, trimmed to the task
    // by the solve that drew it — not the gesture's, which may reach past it.
    const kept = paceable(ended.taskId)?.shareOverrides ?? [];
    if (!ended.previewed || samePeriods(kept, ended.original ?? [])) restore(ended);
    else commit(ended.taskId, kept, ended);
  }

  function onKey(event: KeyboardEvent) {
    if (!drag) return;
    // Every key, not Escape alone: an undo or a Del landing mid-drag would
    // change the plan under a preview that is about to be put back.
    event.stopPropagation();
    event.preventDefault();
    if (event.key !== 'Escape') return;
    const ended = drag;
    endDrag();
    restore(ended);
  }

  const onDown = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const handle = (event.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-pace-part]');
    const owner = handle?.closest<HTMLElement>('[data-pace-task]');
    if (!handle || !owner) return;
    // Ours alone: no text selection, and nothing else in the chart reads it.
    event.stopPropagation();
    event.preventDefault();
    const taskId = owner.dataset.paceTask!;
    const index = Number(owner.dataset.paceIndex);
    const task = paceable(taskId);
    const period = task?.shareOverrides?.[index];
    if (!task || !period) return;
    const part = handle.dataset.pacePart as DragPart | 'delete';
    if (part === 'delete') {
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 0);
      commit(taskId, removePeriod(task.shareOverrides!, index));
      return;
    }
    drag = {
      taskId,
      index,
      part,
      original: task.shareOverrides,
      atPress: new Map(options.project().tasks.map((other) => [other.id, other.shareOverrides])),
      shown: task.shareOverrides!,
      previewed: false,
      startY: event.clientY,
      startShare: period.share,
      barHeight: owner.offsetHeight || 1,
    };
    gantt.ext.tooltips.tooltip.hide();
    document.body.classList.add(part === 'level' ? 'pace-dragging-y' : 'pace-dragging-x');
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
    // On the window, ahead of the app's own document-level shortcuts.
    window.addEventListener('keydown', onKey, true);
    paint();
    showTip(event, drag);
  };

  const onClick = (event: MouseEvent) => {
    const onHandle = (event.target as HTMLElement | null)?.closest?.('[data-pace-part]');
    if (!onHandle && !swallowClick) return;
    event.stopPropagation();
    event.preventDefault();
  };

  const onDblClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.('[data-pace-part]')) {
      event.stopPropagation();
      return;
    }
    // The bar alone: a double-click beside it points at no day of the task.
    const taskId = target?.closest?.('.gantt_task_line')?.getAttribute('data-task-id');
    const task = paceable(taskId);
    const date = dateUnder(event);
    if (!task || !date) return;
    // A closed day inside the bar stands for the working day beside it.
    const day = daysOf(task.id)?.nearestOrdinal(dayIndexOf(date));
    if (day === undefined) return;
    const solved = options.solved();
    const periods = task.shareOverrides ?? [];
    const next = addPeriod(
      periods,
      day,
      seedShare(task, solved.schedule.tasks.get(task.id), day, solved.calendar.minutesPerDay),
    );
    if (next !== periods) commit(task.id, next);
  };

  const setHot = (taskId: string | null) => {
    if (taskId === hotTask) return;
    hotTask = taskId;
    for (const node of nodes.values()) {
      node.classList.toggle('pace-period--hot', node.dataset.paceTask === hotTask);
    }
    markHotBar();
  };

  /**
   * A class, not `:hover`: a period's body lets the pointer through to the bar
   * under it, so the period itself is never the hovered element.
   */
  const onHover = (event: MouseEvent) => {
    if (drag) return;
    const target = event.target as HTMLElement | null;
    setHot(
      target?.closest?.<HTMLElement>('[data-pace-task]')?.dataset.paceTask ??
        target?.closest?.('.gantt_task_line, .gantt_task_row')?.getAttribute('data-task-id') ??
        null,
    );
  };
  const onLeave = () => {
    if (!drag) setHot(null);
  };

  container.addEventListener('mousedown', onDown, true);
  container.addEventListener('click', onClick, true);
  container.addEventListener('dblclick', onDblClick, true);
  container.addEventListener('mousemove', onHover);
  container.addEventListener('mouseleave', onLeave);

  const repaint = () => {
    paint();
    return true;
  };
  const handlers = [
    gantt.attachEvent('onGanttRender', repaint, undefined),
    // onGanttRender alone is a render behind: refreshData sizes the rows after it.
    gantt.attachEvent('onDataRender', repaint, undefined),
    // dhtmlx moves the bar under the pointer without a render, so the periods
    // would stay behind where the task was: out of sight until it lands.
    gantt.attachEvent(
      'onBeforeTaskDrag',
      () => {
        layer.hidden = true;
        return true;
      },
      undefined,
    ),
  ];
  const showLayer = () => {
    layer.hidden = false;
  };
  document.addEventListener('mouseup', showLayer, true);

  paint();

  return () => {
    hotTask = null;
    markHotBar();
    if (drag) {
      const ended = drag;
      endDrag();
      restore(ended);
    }
    container.removeEventListener('mousedown', onDown, true);
    container.removeEventListener('click', onClick, true);
    container.removeEventListener('dblclick', onDblClick, true);
    container.removeEventListener('mousemove', onHover);
    container.removeEventListener('mouseleave', onLeave);
    document.removeEventListener('mouseup', showLayer, true);
    handlers.forEach((id) => gantt.detachEvent(id));
    layer.remove();
    tip.remove();
  };
}
