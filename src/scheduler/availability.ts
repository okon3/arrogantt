import type { WorkingCalendar } from './calendar';
import { dayIndexOfString, expandRanges, isDayString } from './dayRange';
import type { Resource, Task } from './types';

/**
 * The share of a full working day a resource can give on a calendar day.
 *
 * An override replaces the default rather than scaling it — somebody at 50%
 * with a period at 25% works at 25% — and where two overlap the last declared
 * wins, so a narrow exception can be carved out of a broad period. Both the
 * simulation and the timeline shading resolve capacity through here, or the
 * chart could show an absence the schedule does not honour.
 */
export function availabilityOnDay(resource: Resource, day: number): number {
  let availability = resource.availability ?? 1;
  for (const override of resource.availabilityOverrides ?? []) {
    if (!isDayString(override.from) || !isDayString(override.to)) continue;
    const first = dayIndexOfString(override.from);
    const last = dayIndexOfString(override.to);
    if (day < Math.min(first, last) || day > Math.max(first, last)) continue;
    availability = Math.max(0, override.availability);
  }
  return availability;
}

/** A stretch of the working-minute axis over which a resource's capacity holds still. */
export interface CapacityInterval {
  from: number;
  to: number;
  availability: number;
}

/**
 * A resource's overrides projected onto the working-minute axis.
 *
 * Every day any override touches is resolved once, so overlapping periods become
 * a single disjoint interval each and a caller has no ordering rule of its own
 * to get wrong.
 *
 * Days that are not working days collapse to the same coordinate, so a period
 * falling entirely on a weekend or inside a company shutdown becomes a
 * zero-width interval and correctly costs nothing.
 */
export function capacityIntervals(
  resource: Resource,
  calendar: WorkingCalendar,
): CapacityInterval[] {
  const intervals: CapacityInterval[] = [];
  for (const day of [...expandRanges(resource.availabilityOverrides)].sort((a, b) => a - b)) {
    const from = calendar.dayStartInWorkingMinutes(day);
    const to = calendar.dayStartInWorkingMinutes(day + 1);
    if (to <= from) continue;
    const availability = availabilityOnDay(resource, day);
    // Consecutive days at the same rate merge into one interval, keeping the
    // event list short for a two-week period.
    const last = intervals[intervals.length - 1];
    if (last && last.to === from && last.availability === availability) last.to = to;
    else intervals.push({ from, to, availability });
  }
  return intervals;
}

/**
 * What a resource can give at a working minute.
 *
 * Shared by the simulation and by anything reading the schedule back, so a
 * capacity shown to the user cannot disagree with the one the rates were divided
 * from.
 */
export function capacityAt(
  resource: Resource,
  intervals: CapacityInterval[],
  at: number,
): number {
  const covering = intervals.find((interval) => at >= interval.from && at < interval.to);
  return covering ? covering.availability : resource.availability ?? 1;
}

/**
 * Where day 0 of a task's share periods opens on the working-minute axis: the
 * working day holding its anchor. The engine and every reader of a period
 * count from here, or a period would be drawn on a day it does not act on.
 */
export function dayZeroStart(anchor: number, minutesPerDay: number): number {
  return Math.floor(anchor / minutesPerDay) * minutesPerDay;
}

/**
 * A task's share periods projected onto the working-minute axis, once it is
 * anchored: a period is a run of working days counted from the anchor's day,
 * so it has no place on the axis before that.
 *
 * Resolved between the periods' own edges, never day by day: disjoint
 * intervals whatever overlaps (last declared wins), at a cost that does not
 * grow with how far out a period reaches.
 */
export function shareIntervals(
  task: Task,
  anchor: number,
  minutesPerDay: number,
): CapacityInterval[] {
  const periods = task.shareOverrides ?? [];
  const zero = dayZeroStart(anchor, minutesPerDay);
  const cuts = [...new Set(periods.flatMap((period) => [period.fromDay, period.toDay + 1]))].sort(
    (a, b) => a - b,
  );
  const intervals: CapacityInterval[] = [];
  for (let index = 0; index + 1 < cuts.length; index++) {
    const day = cuts[index];
    let share: number | undefined;
    for (const period of periods) {
      if (period.fromDay <= day && day <= period.toDay) share = period.share;
    }
    if (share === undefined) continue;
    const from = zero + day * minutesPerDay;
    const to = zero + cuts[index + 1] * minutesPerDay;
    const last = intervals[intervals.length - 1];
    if (last && last.to === from && last.availability === share) last.to = to;
    else intervals.push({ from, to, availability: share });
  }
  return intervals;
}

/**
 * The share of its resource's capacity a task is fixed at, at a working minute.
 * Undefined where neither a period nor a default fixes one: the task then takes
 * whatever the split leaves it.
 */
export function shareAt(
  task: Task,
  intervals: CapacityInterval[],
  at: number,
): number | undefined {
  const covering = intervals.find((interval) => at >= interval.from && at < interval.to);
  const share = covering ? covering.availability : task.share;
  return share === undefined ? undefined : Math.min(1, Math.max(0, share));
}
