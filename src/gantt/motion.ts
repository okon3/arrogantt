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

/** `--motion-fold`, read like the other tokens: `0` under `prefers-reduced-motion`. */
const foldMs = () =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion-fold')) || 0;

/**
 * A critically damped spring (no overshoot) as a CSS `linear()` curve over
 * `duration`: the reference demo's fold, stiffened to make up for the redraw dhtmlx
 * spends before the first frame.
 */
function springEasing(duration: number) {
  const omega = 20; // per second
  const points = Array.from({ length: 25 }, (_, i) => {
    const t = (i / 24) * (duration / 1000);
    return i === 24 ? 1 : 1 - (1 + omega * t) * Math.exp(-omega * t);
  });
  return `linear(${points.map((p) => p.toFixed(4)).join(', ')})`;
}

const gridRows = () =>
  gantt.$grid_data ? [...gantt.$grid_data.querySelectorAll<HTMLElement>('.gantt_row[data-task-id]')] : [];

const rowId = (node: HTMLElement) => node.dataset.taskId ?? node.dataset.paceTask!;

/** Every node drawn for a task's row, in both panes: what a fold must move together. */
const rowNodes = () => [
  ...gridRows(),
  ...(gantt.$task_data
    ? gantt.$task_data.querySelectorAll<HTMLElement>(
        '.gantt_task_row[data-task-id], .gantt_task_line[data-task-id], [data-pace-task]',
      )
    : []),
];

const rowTops = () => new Map(gridRows().map((node) => [rowId(node), node.getBoundingClientRect().top]));

/**
 * Read before branch `parentId` opens or closes; the returned call, run once
 * the redraw is done, folds the rows like a lane: children slide out
 * of the parent's row on open and back into it on close, fading, while the rows
 * below follow. Every node of a row gets the same offset, so grid and timeline
 * stay level. dhtmlx drops closed rows from the DOM before anything can move
 * them, so a closing branch is animated on inert copies taken here.
 */
export function foldRows(parentId: string): () => void {
  const duration = foldMs();
  if (!duration) return () => {};
  const before = rowTops();
  const parentTop = before.get(parentId);
  if (parentTop === undefined) return () => {};
  const folded = (id: string) => gantt.isTaskExists(id) && gantt.isChildOf(id, parentId);
  const ghosts = gantt.getTask(parentId).$open
    ? rowNodes()
        .filter((node) => folded(rowId(node)))
        .map((node) => ({
          host: node.parentElement!,
          copy: node.cloneNode(true) as HTMLElement,
          top: node.getBoundingClientRect().top,
          inRow: node.getBoundingClientRect().top - before.get(rowId(node))!,
        }))
    : [];

  return () => {
    const easing = springEasing(duration);
    const easeOutCss = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim();
    const fade = duration * 0.35;
    const shift = new Map<string, { dy: number; fades: boolean }>();
    let above = 0;
    const rows = gridRows()
      .map((node) => ({ id: rowId(node), top: node.getBoundingClientRect().top }))
      .sort((a, b) => a.top - b.top);
    const parentNow = rows.find((row) => row.id === parentId)?.top ?? parentTop;
    for (const { id, top } of rows) {
      const was = before.get(id);
      if (was !== undefined) above = was - top;
      // A row scrolled in from below follows the one above it.
      const dy = was === undefined && folded(id) ? parentTop - top : above;
      shift.set(id, { dy, fades: was === undefined && folded(id) });
    }
    // Rows cross each other on the way: an opaque one would cut the text of the
    // one under it. Same colour as the chart behind, so at rest nothing changes.
    const see = (node: HTMLElement) => (node.matches('.gantt_row, .gantt_task_row') ? { background: 'transparent' } : {});
    for (const node of rowNodes()) {
      const row = shift.get(rowId(node));
      if (!row) continue;
      if (Math.abs(row.dy) >= 1) {
        node.animate([{ transform: `translateY(${row.dy}px)`, ...see(node) }, { transform: 'none', ...see(node) }], {
          duration,
          easing,
        });
      }
      if (row.fades) node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fade, easing: easeOutCss });
    }
    // Screen coordinates on both ends: a close that shortens the chart can clamp
    // the scroll, which moves the copies' host and the parent's row with it.
    for (const { host, copy, top, inRow } of ghosts) {
      if (!host.isConnected) continue;
      copy.removeAttribute('data-task-id');
      copy.removeAttribute('task_id');
      copy.removeAttribute('data-pace-task');
      copy.style.pointerEvents = 'none';
      copy.style.background = 'transparent';
      host.append(copy);
      const now = copy.getBoundingClientRect().top;
      copy.animate(
        [{ transform: `translateY(${top - now}px)` }, { transform: `translateY(${parentNow + inRow - now}px)` }],
        { duration, easing },
      );
      copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fade, easing: 'linear', fill: 'forwards' }).onfinish =
        () => copy.remove();
    }
    const icon = gantt.$grid_data?.querySelector<HTMLElement>(`.gantt_row[data-task-id="${parentId}"] .gantt_tree_icon`);
    // The glyph swapped with the redraw; turning it from the old one's angle reads as one chevron.
    const from = gantt.getTask(parentId).$open ? '-90deg' : '90deg';
    icon?.animate([{ rotate: from }, { rotate: '0deg' }], { duration: duration * 0.6, easing });
  };
}
