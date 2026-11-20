import {
  dateOfDay,
  dayIndexOf,
  dayIndexOfString,
  dayStringOf,
  type ShareOverride,
} from '../scheduler';

/**
 * What a gesture on a bar's pace periods stands for: the pure half of
 * `paceHandles.ts`. Days are day indices, a span is inclusive at both ends,
 * and every function answers a new list — the caller's is never touched.
 */

/** A task's solved start and end days, inclusive. */
export interface DaySpan {
  from: number;
  to: number;
}

/** Narrower than this a period keeps its ticks and lets the pointer through. */
export const MIN_INTERACTIVE_PX = 14;

/** A drag of the level grip moves the share in tenths. */
const SHARE_STEPS = 10;

/**
 * The midnight nearest to `date`, as the index of the day starting there: an
 * edge is dropped on the boundary the pointer is closest to, not on the one
 * before it.
 */
export function nearestMidnight(date: Date): number {
  const day = dayIndexOf(date);
  const before = date.getTime() - dateOfDay(day).getTime();
  const after = dateOfDay(day + 1).getTime() - date.getTime();
  return before < after ? day : day + 1;
}

/**
 * The periods as they may stand on a task spanning `from..to`: one wholly
 * outside is dropped, one partly outside is trimmed to it.
 */
export function clipToSpan(periods: ShareOverride[], from: number, to: number): ShareOverride[] {
  return periods.flatMap((period) => {
    const first = Math.max(dayIndexOfString(period.from), from);
    const last = Math.min(dayIndexOfString(period.to), to);
    if (last < first) return [];
    return [{ ...period, from: dayStringOf(first), to: dayStringOf(last) }];
  });
}

/**
 * How far the edges of `period` may be dragged: over the task's span as it is
 * solved now, so an edge follows a bar its own period makes longer, and never
 * short of where the period already stands.
 *
 * The start the drag began with stays reachable too. A pause dragged over a
 * bar's first days pushes the solved start past itself, and a clamp read live
 * alone would throw the edge back, re-solve, and let it through again.
 */
export function dragSpan(atPress: DaySpan, live: DaySpan, period: ShareOverride): DaySpan {
  return {
    from: Math.min(atPress.from, live.from, dayIndexOfString(period.from)),
    to: Math.max(live.to, dayIndexOfString(period.to)),
  };
}

/**
 * The list with one edge of period `index` dropped on the midnight `boundary`.
 *
 * Past its own other edge the period has no day left and is removed — that is
 * the delete gesture, and it never reaches a neighbour. Otherwise the edge
 * stops at the day beside the neighbouring period and inside `span`.
 */
export function moveEdge(
  periods: ShareOverride[],
  index: number,
  edge: 'from' | 'to',
  boundary: number,
  span: DaySpan,
): ShareOverride[] {
  const period = periods[index];
  const without = periods.filter((_, position) => position !== index);
  let from = dayIndexOfString(period.from);
  let to = dayIndexOfString(period.to);
  if (edge === 'from') {
    if (boundary > to) return without;
    const neighbours = without.map((other) => dayIndexOfString(other.to)).filter((day) => day < to);
    from = Math.max(boundary, ...neighbours.map((day) => day + 1));
  } else {
    if (boundary - 1 < from) return without;
    const neighbours = without
      .map((other) => dayIndexOfString(other.from))
      .filter((day) => day > from);
    to = Math.min(boundary - 1, ...neighbours.map((day) => day - 1));
  }
  const [clipped] = clipToSpan(
    [{ ...period, from: dayStringOf(from), to: dayStringOf(to) }],
    span.from,
    span.to,
  );
  if (!clipped) return without;
  return periods.map((other, position) => (position === index ? clipped : other));
}

/**
 * The share a grip taken at `startShare` stands for once the pointer has
 * risen `risePx` on a bar `barHeight` tall: whole steps, 0 (paused) to 1.
 */
export function levelShare(startShare: number, risePx: number, barHeight: number): number {
  const raw = startShare + risePx / barHeight;
  return Math.min(1, Math.max(0, Math.round(raw * SHARE_STEPS) / SHARE_STEPS));
}

export function setLevel(periods: ShareOverride[], index: number, share: number): ShareOverride[] {
  return periods.map((period, position) => (position === index ? { ...period, share } : period));
}

/**
 * The list with a one-day period on `day`, or the list itself where none may
 * go: outside the task's span, or on a day a period already holds.
 */
export function addPeriod(
  periods: ShareOverride[],
  day: number,
  share: number,
  span: DaySpan,
): ShareOverride[] {
  if (day < span.from || day > span.to) return periods;
  const date = dayStringOf(day);
  if (periods.some((period) => period.from <= date && date <= period.to)) return periods;
  return [...periods, { from: date, to: date, share }];
}

export function removePeriod(periods: ShareOverride[], index: number): ShareOverride[] {
  return periods.filter((_, position) => position !== index);
}

export function samePeriods(a: ShareOverride[], b: ShareOverride[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (period, index) =>
        period.from === b[index].from &&
        period.to === b[index].to &&
        period.share === b[index].share &&
        period.label === b[index].label,
    )
  );
}

export interface PeriodBox {
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
  share: number;
  /** Too narrow to aim at. */
  tiny: boolean;
}

/**
 * Where each period sits over its bar, in the data area's pixels.
 *
 * `firstDay..endDay` is the rendered range, `endDay` exclusive: a period is
 * clipped to it, since `dayX` extrapolates past the range and would stretch
 * the scrollable area. One wholly outside gets no box.
 */
export function periodBoxes(
  periods: ShareOverride[],
  rendered: { firstDay: number; endDay: number },
  bar: { top: number; height: number; rowHeight: number },
  dayX: (day: number) => number,
): PeriodBox[] {
  return periods.flatMap((period, index) => {
    const start = Math.max(dayIndexOfString(period.from), rendered.firstDay);
    const end = Math.min(dayIndexOfString(period.to) + 1, rendered.endDay);
    if (end <= start) return [];
    const left = dayX(start);
    const width = dayX(end) - left;
    return [
      {
        index,
        left,
        // The position is the row's; the bar is centred in it.
        top: bar.top + (bar.rowHeight - bar.height) / 2,
        width,
        height: bar.height,
        share: period.share,
        tiny: width < MIN_INTERACTIVE_PX,
      },
    ];
  });
}

/** What the readout and the drag tip say of a share. */
export function shareLabel(share: number): string {
  return share === 0 ? 'paused' : `${Math.round(share * 100)}%`;
}
