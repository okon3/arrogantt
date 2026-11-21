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
