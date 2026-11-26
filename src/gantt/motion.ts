import { gantt } from 'dhtmlx-gantt';

/** A `--motion-*` token in ms; `0` under `prefers-reduced-motion`, which zeroes the tokens. */
export const motionMs = (token: '--motion-fast' | '--motion-base') =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token)) || 0;

/** Cubic ease-out, the JS twin of `--ease-out` for animations CSS cannot drive. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Scrolls the timeline to `x` over `--motion-base`, vertical scroll untouched. */
export function glideScrollX(to: number) {
  const from = gantt.getScrollState().x;
  const duration = motionMs('--motion-base');
  if (!duration || from === to) {
    gantt.scrollTo(to, null);
    return;
  }
  const started = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - started) / duration);
    gantt.scrollTo(from + (to - from) * easeOut(t), null);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const barNodes = () =>
  gantt.$task_data ? [...gantt.$task_data.querySelectorAll<HTMLElement>('.gantt_task_line[task_id]')] : [];

/** Where each drawn bar sits on screen, by task id — read before a redraw replaces the nodes. */
export const barRects = () => new Map(barNodes().map((node) => [node.getAttribute('task_id')!, node.getBoundingClientRect()]));

/**
 * Slides every redrawn bar from where `before` saw it to where it is now, so an
 * edit shows what it moved. Screen coordinates, so a range or scroll change in
 * the same redraw is part of what the eye saw. Bars off screen before or after
 * have no node and simply appear.
 */
export function glideBars(before: Map<string, DOMRect>) {
  const duration = motionMs('--motion-base');
  if (!duration || before.size === 0) return;
  const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim();
  for (const node of barNodes()) {
    const was = before.get(node.getAttribute('task_id')!);
    if (!was) continue;
    const now = node.getBoundingClientRect();
    // A bar on another row was moved by the tree, not by the schedule.
    if (Math.abs(was.top - now.top) > 1) continue;
    const dx = was.left - now.left;
    const dw = was.width - now.width;
    if (Math.abs(dx) < 1 && Math.abs(dw) < 1) continue;
    // left/width rather than a transform: scaleX would stretch the label inside.
    const left = parseFloat(node.style.left);
    const width = parseFloat(node.style.width);
    const sized = Number.isFinite(width);
    node.animate(
      [
        { left: `${left + dx}px`, ...(sized && { width: `${width + dw}px` }) },
        { left: `${left}px`, ...(sized && { width: `${width}px` }) },
      ],
      { duration, easing },
    );
  }
}

const gridRows = () =>
  gantt.$grid_data ? [...gantt.$grid_data.querySelectorAll<HTMLElement>('.gantt_row[data-task-id]')] : [];

const rowId = (node: HTMLElement) => node.dataset.taskId ?? node.dataset.paceTask!;

/** Every node drawn for a task's row, in both panes: what a toggle must move together. */
const rowNodes = () => [
  ...gridRows(),
  ...(gantt.$task_data
    ? gantt.$task_data.querySelectorAll<HTMLElement>(
        '.gantt_task_row[data-task-id], .gantt_task_line[data-task-id], [data-pace-task]',
      )
    : []),
];

/** Where each grid row sits on screen, by task id — read before a branch toggles. */
export const rowTops = () => new Map(gridRows().map((node) => [rowId(node), node.getBoundingClientRect().top]));

/**
 * Slides the rows a branch toggle moved from where `before` saw them, every
 * node of a row by the same offset so grid and timeline stay level. A row with
 * no `before` (a child just shown, a row scrolled in from below) takes the
 * offset of the row above it and fades in: it was hidden under that row.
 */
export function slideRows(before: Map<string, number>) {
  const duration = motionMs('--motion-base');
  if (!duration || before.size === 0) return;
  const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim();
  const shift = new Map<string, { dy: number; entering: boolean }>();
  let above = 0;
  const rows = gridRows()
    .map((node) => ({ id: rowId(node), top: node.getBoundingClientRect().top }))
    .sort((a, b) => a.top - b.top);
  for (const { id, top } of rows) {
    const was = before.get(id);
    if (was !== undefined) above = was - top;
    shift.set(id, { dy: above, entering: was === undefined });
  }
  for (const node of rowNodes()) {
    const row = shift.get(rowId(node));
    if (!row || (!row.entering && Math.abs(row.dy) < 1)) continue;
    node.animate(
      [
        { transform: `translateY(${row.dy}px)`, ...(row.entering && { opacity: 0 }) },
        { transform: 'none', ...(row.entering && { opacity: 1 }) },
      ],
      { duration, easing },
    );
  }
}
