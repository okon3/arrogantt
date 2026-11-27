import type { ScheduledTask } from '../scheduler';
import { needsDarkInk } from './colors';

/** Narrower than this and the percentage would not fit or would collide. */
const MIN_LABEL_WIDTH_PX = 30;
/** Above this rate the filled area is tall enough to hold the label inside it. */
const LABEL_INSIDE_RATE = 0.45;
/** Radius of the profile's corners: a change of rate reads as a soft step, not a notch. */
const STEP_RADIUS_PX = 4;

export type Point = [x: number, y: number];

/**
 * The outline through `points` (percentages of the bar, every edge horizontal
 * or vertical) with each inner corner rounded. The radius is taken in pixels
 * and converted per axis, since the viewBox stretches unevenly; a short edge
 * caps it at half its length, so two corners never overlap. With both sizes
 * 100, points are taken as pixels: the help diagram draws through it that way.
 */
export function roundedOutline(points: Point[], widthPx: number, heightPx: number): string {
  const kept = points.filter(
    (point, index) =>
      index === 0 || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1],
  );
  const corners = kept.filter((point, index) => {
    const before = kept[index - 1];
    const after = kept[index + 1];
    if (!before || !after) return true;
    // A point midway along a straight edge is no corner.
    return !(
      (before[0] === point[0] && point[0] === after[0]) ||
      (before[1] === point[1] && point[1] === after[1])
    );
  });
  const pixels = (from: Point, to: Point) =>
    Math.abs(to[0] - from[0]) * (widthPx / 100) + Math.abs(to[1] - from[1]) * (heightPx / 100);
  const toward = (from: Point, to: Point, px: number): Point => {
    const length = pixels(from, to);
    const share = length === 0 ? 0 : px / length;
    return [from[0] + (to[0] - from[0]) * share, from[1] + (to[1] - from[1]) * share];
  };
  const xy = ([x, y]: Point) => `${x.toFixed(2)},${y.toFixed(2)}`;
  let path = `M ${xy(corners[0])}`;
  for (let index = 1; index < corners.length - 1; index++) {
    const [before, corner, after] = [corners[index - 1], corners[index], corners[index + 1]];
    const radius = Math.min(STEP_RADIUS_PX, pixels(before, corner) / 2, pixels(corner, after) / 2);
    path += ` L ${xy(toward(corner, before, radius))} Q ${xy(corner)} ${xy(toward(corner, after, radius))}`;
  }
  return `${path} L ${xy(corners[corners.length - 1])} Z`;
}

export function isShared(scheduled: ScheduledTask): boolean {
  return scheduled.segments.some((segment) => segment.rate < 1);
}

/**
 * Whether the bar draws the allocation profile rather than a plain fill.
 *
 * `paced`: the task carries share settings of its own. Only then does a gap
 * between segments call for the profile, so a stretch the task is stopped by
 * its own 0% reads as empty track — while a full-rate bar spanning its
 * person's absence stays the plain fill it has always been. A wait before the
 * first segment is only ever a share's doing, its own or another task's.
 */
export function drawsProfile(scheduled: ScheduledTask, paced: boolean): boolean {
  return (
    isShared(scheduled) ||
    (scheduled.segments.length > 0 &&
      scheduled.segments[0].startWorkingMinutes > scheduled.startWorkingMinutes) ||
    (paced &&
      scheduled.segments.some(
        (segment, index) =>
          index > 0 &&
          segment.startWorkingMinutes > scheduled.segments[index - 1].endWorkingMinutes,
      ))
  );
}

/**
 * Renders the allocation profile inside the task bar.
 *
 * Drawn as one continuous SVG path rather than a block per regime: separate
 * blocks, each with its own border and rounded corners, read as separate tasks
 * instead of one task whose intensity changes. The path is anchored to the
 * bottom of the bar, so a task at 100% fills it completely and looks like an
 * ordinary Gantt bar, while a shared stretch dips.
 *
 * The viewBox is 0..100 on both axes with `preserveAspectRatio="none"`, so x
 * coordinates are percentages of the bar and no measurement is needed. Labels
 * stay in HTML: non-uniform scaling would distort SVG text.
 *
 * `barWidthPx` only decides which labels fit; the geometry is resolution-free.
 */
export function renderSegments(
  scheduled: ScheduledTask,
  barWidthPx: number,
  barHeightPx: number,
  fill: string,
  stroke: string,
): string {
  const spanMs = scheduled.end.getTime() - scheduled.start.getTime();
  // Whether to draw at all is `drawsProfile`'s verdict, taken by the caller.
  if (spanMs <= 0 || scheduled.segments.length === 0) return '';

  const origin = scheduled.start.getTime();
  const asPercent = (date: Date) => ((date.getTime() - origin) / spanMs) * 100;

  // Along the floor to where work begins: the span opens on the anchor.
  const outline: Point[] = [[0, 100], [asPercent(scheduled.segments[0].start), 100]];
  const labels: string[] = [];

  scheduled.segments.forEach((segment, index) => {
    const next = scheduled.segments[index + 1];
    const from = asPercent(segment.start);
    // Consecutive segments are contiguous in *working* time but not on the wall
    // clock: one ends at 17:00 and the next starts at 08:00, and those night and
    // weekend hours still occupy pixels. Carrying the level across to the next
    // segment keeps one shape whose steps are real allocation changes; stopping
    // at `segment.end` instead punches a hole at every nightfall.
    const idleAhead = next && next.startWorkingMinutes > segment.endWorkingMinutes;
    const to = next && !idleAhead ? asPercent(next.start) : asPercent(segment.end);
    const top = 100 - segment.rate * 100;

    outline.push([from, top], [to, top]);
    // Idle time inside the span drops the outline to the floor, so the stop
    // stays visible.
    if (idleAhead) outline.push([to, 100], [asPercent(next.start), 100]);

    if (((to - from) / 100) * barWidthPx >= MIN_LABEL_WIDTH_PX) {
      const centre = (from + to) / 2;
      const percent = Math.round(segment.rate * 100);
      // A thin band cannot hold the text, so it sits just above the fill and
      // switches to dark ink against the empty part of the bar.
      const inside = segment.rate >= LABEL_INSIDE_RATE;
      const style = inside
        ? `left:${centre.toFixed(2)}%;top:${(100 - segment.rate * 50).toFixed(2)}%`
        : `left:${centre.toFixed(2)}%;bottom:${(segment.rate * 100).toFixed(2)}%`;
      // Sitting on the fill, the badge's ink has to follow the fill: a pale
      // tint needs dark ink the same way the empty track does above.
      const modifier = inside ? (needsDarkInk(fill) ? ' seg-pct--dark' : '') : ' seg-pct--above';
      labels.push(`<span class="seg-pct${modifier}" style="${style}">${percent}%</span>`);
    }
  });
  outline.push([100, 100]);
  const path = roundedOutline(outline, barWidthPx, barHeightPx);

  return (
    '<div class="seg-track">' +
    '<svg class="seg-fill" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    // Inline style, not fill/stroke attributes: a stylesheet rule outranks an SVG
    // presentation attribute, so an attribute here would be silently overridden.
    `<path d="${path}" style="fill:${fill};stroke:${stroke}" vector-effect="non-scaling-stroke" /></svg>` +
    labels.join('') +
    '</div>'
  );
}
