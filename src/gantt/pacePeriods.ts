import { dateOfDay, dayIndexOf, type ShareOverride } from '../scheduler';

/**
 * What a gesture on a bar's pace periods stands for: the pure half of
 * `paceHandles.ts`. A period's days are working days of its task, counted
 * from the task's day 0 and inclusive at both ends, and every function answers
 * a new list — the caller's is never touched.
 */

/** Narrower than this a period has no room for its handles, which move outside it. */
export const NARROW_PX = 28;

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
 * The list with one edge of period `index` moved onto the task's working day
 * `day`: the period's first day for `from`, its last for `to`.
 *
 * Past its own other edge the period has no day left and is removed — that is
 * the delete gesture, and it never reaches a neighbour. Otherwise the edge
 * stops at the day beside the neighbouring period, and at day 0. Nothing stops
 * it at the task's end: only the solve of this very list knows where that is,
 * and `trimToTask` cuts it there.
 */
export function moveEdge(
  periods: ShareOverride[],
  index: number,
  edge: 'from' | 'to',
  day: number,
): ShareOverride[] {
  const period = periods[index];
  const without = periods.filter((_, position) => position !== index);
  let { fromDay, toDay } = period;
  if (edge === 'from') {
    if (day > toDay) return without;
    const neighbours = without.map((other) => other.toDay).filter((last) => last < toDay);
    fromDay = Math.max(0, day, ...neighbours.map((last) => last + 1));
  } else {
    if (day < fromDay) return without;
    const neighbours = without.map((other) => other.fromDay).filter((first) => first > fromDay);
    toDay = Math.min(day, ...neighbours.map((first) => first - 1));
  }
  return periods.map((other, position) =>
    position === index ? { ...period, fromDay, toDay } : other,
  );
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
 * The list with a one-day period on the task's working day `day`, or the
 * list itself where a period already holds it.
 */
export function addPeriod(periods: ShareOverride[], day: number, share: number): ShareOverride[] {
  if (periods.some((period) => period.fromDay <= day && day <= period.toDay)) return periods;
  return [...periods, { fromDay: day, toDay: day, share }];
}

export function removePeriod(periods: ShareOverride[], index: number): ShareOverride[] {
  return periods.filter((_, position) => position !== index);
}

export function samePeriods(a: ShareOverride[], b: ShareOverride[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (period, index) =>
        period.fromDay === b[index].fromDay &&
        period.toDay === b[index].toDay &&
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
 * A box runs over the calendar days from the period's first working day to its
 * last (`dayOf`), so across a weekend it spans it. `firstDay..endDay` is the
 * rendered range, `endDay` exclusive: a period is clipped to it, since `dayX`
 * extrapolates past the range and would stretch the scrollable area. One
 * wholly outside gets no box.
 */
export function periodBoxes(
  periods: ShareOverride[],
  rendered: { firstDay: number; endDay: number },
  bar: { top: number; height: number; rowHeight: number },
  dayX: (day: number) => number,
  dayOf: (ordinal: number) => number,
): PeriodBox[] {
  return periods.flatMap((period, index) => {
    const start = Math.max(dayOf(period.fromDay), rendered.firstDay);
    const end = Math.min(dayOf(period.toDay) + 1, rendered.endDay);
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
        tiny: width < NARROW_PX,
      },
    ];
  });
}

/** What the drag tip says of a share. */
export function shareLabel(share: number): string {
  return share === 0 ? 'paused' : `${Math.round(share * 100)}%`;
}
