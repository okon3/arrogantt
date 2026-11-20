import { gantt } from 'dhtmlx-gantt';
import { X } from 'lucide-static';
import { dateOfDay, dayIndexOf, type ShareOverride } from '../scheduler';
import {
  addPeriod,
  dragSpan,
  levelShare,
  moveEdge,
  nearestMidnight,
  periodBoxes,
  removePeriod,
  samePeriods,
  setLevel,
  shareLabel,
  type DaySpan,
  type PeriodBox,
} from './pacePeriods';
import { isMilestone, type Project, type ProjectTask, type SolvedProject } from './project';
import { parseTaskShare, seedShare } from './taskShare';

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
   * Shows `periods` on the task while a drag is under way: the plan is
   * re-solved and redrawn, and nobody is told — no undo step, no draft.
   * `undefined` is the task with none, which is how a drag puts back a model
   * that held none.
   */
  preview(taskId: string, periods: ShareOverride[] | undefined): void;
  /** The edit itself: one undo step. */
  commit(taskId: string, periods: ShareOverride[]): void;
  reject(message: string): void;
}

type DragPart = 'from' | 'to' | 'level';

interface Drag {
  taskId: string;
  index: number;
  part: DragPart;
  /** The model's own list at the press, which Escape puts back as it was. */
  original: ShareOverride[] | undefined;
  /** The list on screen: the last one previewed. */
  shown: ShareOverride[];
  previewed: boolean;
  spanAtPress: DaySpan;
  startY: number;
  startShare: number;
  barHeight: number;
}

const PARTS =
  `<div class="pace-edge pace-edge--from" data-pace-part="from"></div>` +
  `<div class="pace-edge pace-edge--to" data-pace-part="to"></div>` +
  `<div class="pace-level" data-pace-part="level"><span class="pace-readout"></span></div>` +
  `<div class="pace-x" data-pace-part="delete" title="Remove this period">${X}</div>`;

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

  const spanOf = (taskId: string): DaySpan | undefined => {
    const scheduled = options.solved().schedule.tasks.get(taskId);
    // The dates the schedule carries, not its minutes converted again.
    return scheduled && { from: dayIndexOf(scheduled.start), to: dayIndexOf(scheduled.end) };
  };

  const classOf = (taskId: string, box: PeriodBox) =>
    'pace-period' +
    (box.tiny ? ' pace-period--tiny' : '') +
    (taskId === hotTask ? ' pace-period--hot' : '') +
    (drag?.taskId === taskId && drag.index === box.index ? ' pace-period--dragging' : '');

  const paint = () => {
    const { min_date: from, max_date: to } = gantt.getState();
    const live = new Set<string>();
    if (from instanceof Date && to instanceof Date) {
      const rendered = { firstDay: dayIndexOf(from), endDay: dayIndexOf(to) };
      for (const task of options.project().tasks) {
        if (!task.shareOverrides || !isPaceable(task)) continue;
        // A row inside a closed branch has no place on the chart.
        if (!gantt.isTaskExists(task.id) || !gantt.isTaskVisible(task.id)) continue;
        const bar = gantt.getTaskPosition(gantt.getTask(task.id));
        const boxes = periodBoxes(
          task.shareOverrides,
          rendered,
          { top: bar.top, height: bar.height, rowHeight: bar.rowHeight ?? bar.height },
          dayX,
        );
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
          node.className = classOf(task.id, box);
          node.style.left = `${box.left}px`;
          node.style.top = `${box.top}px`;
          node.style.width = `${box.width}px`;
          node.style.height = `${box.height}px`;
          // The period's share of the person, not the rate the bar draws.
          (node.querySelector('.pace-level') as HTMLElement).style.top =
            `${((1 - box.share) * 100).toFixed(1)}%`;
          node.querySelector('.pace-readout')!.textContent = shareLabel(box.share);
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
  const commit = (taskId: string, periods: ShareOverride[], original: ShareOverride[] | undefined) => {
    let parsed: ShareOverride[];
    try {
      parsed = parseTaskShare(undefined, periods).shareOverrides ?? [];
    } catch (problem) {
      options.preview(taskId, original);
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
    const live = spanOf(current.taskId);
    if (!date || !live) return current.shown;
    const span = dragSpan(current.spanAtPress, live, base[current.index]);
    return moveEdge(base, current.index, current.part, nearestMidnight(date), span);
  };

  const showTip = (event: MouseEvent, current: Drag) => {
    const period =
      current.shown.length === (current.original ?? []).length
        ? current.shown[current.index]
        : undefined;
    tip.hidden = false;
    tip.textContent = period
      ? `${period.from} → ${period.to} · ${shareLabel(period.share)}`
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
      options.preview(drag.taskId, next);
    }
    showTip(event, drag);
  }

  /** Puts the model back exactly as the press found it. */
  const restore = (ended: Drag) => {
    if (ended.previewed) options.preview(ended.taskId, ended.original);
    else paint();
  };

  function onUp(event: MouseEvent) {
    if (!drag) return;
    event.stopPropagation();
    // What was last shown is what is kept: the span is read live, and a list
    // recomputed here could differ from the one on screen.
    const ended = drag;
    endDrag();
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 0);
    if (samePeriods(ended.shown, ended.original ?? [])) restore(ended);
    else commit(ended.taskId, ended.shown, ended.original);
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
    const span = spanOf(taskId);
    if (!task || !period || !span) return;
    const part = handle.dataset.pacePart as DragPart | 'delete';
    if (part === 'delete') {
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 0);
      commit(taskId, removePeriod(task.shareOverrides!, index), task.shareOverrides);
      return;
    }
    drag = {
      taskId,
      index,
      part,
      original: task.shareOverrides,
      shown: task.shareOverrides!,
      previewed: false,
      spanAtPress: span,
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
    const span = spanOf(task.id);
    if (!span) return;
    const solved = options.solved();
    const day = dayIndexOf(date);
    const periods = task.shareOverrides ?? [];
    const next = addPeriod(
      periods,
      day,
      seedShare(task, solved.schedule.tasks.get(task.id), day, solved.calendar),
      span,
    );
    if (next !== periods) commit(task.id, next, task.shareOverrides);
  };

  const setHot = (taskId: string | null) => {
    if (taskId === hotTask) return;
    hotTask = taskId;
    for (const node of nodes.values()) {
      node.classList.toggle('pace-period--hot', node.dataset.paceTask === hotTask);
    }
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
  ];

  paint();

  return () => {
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
    handlers.forEach((id) => gantt.detachEvent(id));
    layer.remove();
    tip.remove();
  };
}
