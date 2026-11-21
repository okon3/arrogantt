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
