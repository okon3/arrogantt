import {
  dayIndexOfString,
  expandRanges,
  isDayString,
  type AllocationSegment,
  type DayRange,
  type Resource,
  type Schedule,
  type WorkingCalendar,
} from '../scheduler';
// Type-only, and `project.ts` imports `Person` the same way: erased at compile
// time, so the pair cannot become a runtime cycle once `solve()` calls back in.
import type { Hierarchy, Project } from './project';

/**
 * The rules for money on the view-side model: a person's rate and a project's
 * currency label. Kept off `src/scheduler/`, which must not learn that a task
 * costs anything — the engine's `Resource` and `Task` stay unmodified, and
 * structural typing is what lets a `Person` stand in for one.
 *
 * The two rule functions live here rather than beside their callers because the
 * file parser, the People dialog and the agent API all have to answer to them,
 * exactly as they answer to `validateResources`.
 */

/** Replaces the default over its days; where two overlap, the last declared wins. */
export interface RateOverride extends DayRange {
  dailyRate: number;
}

export interface Person extends Resource {
  /** Money per working day of effort. Absent = no rate: cost unknown, never 0. */
  dailyRate?: number;
  rateOverrides?: RateOverride[];
}

/**
 * The rate in force on a calendar day index, or `undefined` where none is
 * declared.
 *
 * The twin of `availabilityOnDay` (`src/scheduler/availability.ts:14-24`):
 * start from the default, walk the overrides in array order, let a matching
 * one replace the running value. Two deliberate departures from the twin:
 *
 * - no implicit default — the initial value is `person.dailyRate`, which may
 *   be `undefined`, and `undefined` is what comes back when nothing declares
 *   a rate;
 * - no `Math.max(0, ...)` clamp — the rules live in `validateResources`, one
 *   place; a resolver that repaired a negative rate would be a second, silent
 *   rule.
 */
export function rateOnDay(person: Person, day: number): number | undefined {
  let rate = person.dailyRate;
  for (const override of person.rateOverrides ?? []) {
    if (!isDayString(override.from) || !isDayString(override.to)) continue;
    const first = dayIndexOfString(override.from);
    const last = dayIndexOfString(override.to);
    if (day < Math.min(first, last) || day > Math.max(first, last)) continue;
    rate = override.dailyRate;
  }
  return rate;
}

const CURRENCY_MESSAGE = 'Currency: a short label of up to 8 characters';

/** The first thing wrong with the label, or null. User-facing English. */
export function validateCurrency(label: string): string | null {
  // The agent API hands over whatever a script passed, so the type is a wish:
  // without this the rule throws a TypeError instead of answering, and its twin
  // `validateCalendar` (`calendarRules.ts:60-62`) guards its own input for the
  // same reason.
  if (typeof label !== 'string') return CURRENCY_MESSAGE;
  // Refuses rather than repairs: the parser and the API never trim on the
  // caller's behalf, so " EUR " is an error, not a currency named "EUR".
  if (label !== label.trim()) return CURRENCY_MESSAGE;
  if (label.length === 0) return CURRENCY_MESSAGE;
  if (label.length > 8) return CURRENCY_MESSAGE;
  return null;
}

/** The parts of a `SolvedProject` the cost reading needs. */
export interface SolvedInputs {
  hierarchy: Hierarchy;
  schedule: Schedule;
  disabledIds: ReadonlySet<string>;
  calendar: WorkingCalendar;
}

/** What one row costs, and how much of its effort had no price. */
export interface TaskCost {
  /** Money over the costed person-days. */
  amount: number;
  costedDays: number;
  /** Person-days that had no rate (no resource, or none on those days). */
  uncostedDays: number;
  /** Distinct rates applied, ascending; `[]` on a summary and with no segments. */
  dailyRates: number[];
}

/** A stretch of the working-minute axis over which a person's rate holds still. */
export interface RateInterval {
  from: number;
  to: number;
  /**
   * Whatever `rateOnDay` answered. A validated override always prices the days
   * it covers, but the resolver's type does not promise one and narrowing it
   * here would be an assertion this function has no way to make.
   */
  dailyRate: number | undefined;
}

/**
 * A person's rate periods projected onto the working-minute axis.
 *
 * The twin of `capacityIntervals` (`src/scheduler/availability.ts:44-61`), with
 * `rateOnDay` in place of `availabilityOnDay`: every day any period touches is
 * resolved once, so overlapping periods become one disjoint interval each and a
 * caller has no ordering rule of its own to get wrong. Non-working days collapse
 * onto the same coordinate, so a period falling entirely on a weekend or inside
 * a shutdown is zero-width and correctly costs nothing.
 */
export function rateIntervals(person: Person, calendar: WorkingCalendar): RateInterval[] {
  const intervals: RateInterval[] = [];
  for (const day of [...expandRanges(person.rateOverrides)].sort((a, b) => a - b)) {
    const from = calendar.dayStartInWorkingMinutes(day);
    const to = calendar.dayStartInWorkingMinutes(day + 1);
    if (to <= from) continue;
    const dailyRate = rateOnDay(person, day);
    const last = intervals[intervals.length - 1];
    if (last && last.to === from && last.dailyRate === dailyRate) last.to = to;
    else intervals.push({ from, to, dailyRate });
  }
  return intervals;
}

/** What a person is paid at a working minute, mirroring `capacityAt` (`availability.ts:70-77`). */
function rateAt(person: Person, intervals: RateInterval[], at: number): number | undefined {
  const covering = intervals.find((interval) => at >= interval.from && at < interval.to);
  return covering ? covering.dailyRate : person.dailyRate;
}

/**
 * A segment cut at every rate change strictly inside it.
 *
 * Half-open on both sides, like the intervals it is cut by: a segment ending
 * exactly on a day's opening belongs to the day before and one starting there to
 * the day after, so the boundary's two wall-clock instants never have to be
 * chosen between — no `Date` is produced anywhere on this path.
 */
function piecesOf(segment: AllocationSegment, intervals: RateInterval[]): [number, number][] {
  const start = segment.startWorkingMinutes;
  const end = segment.endWorkingMinutes;
  const cuts = new Set<number>();
  for (const interval of intervals) {
    for (const bound of [interval.from, interval.to]) {
      if (bound > start && bound < end) cuts.add(bound);
    }
  }
  const bounds = [start, ...[...cuts].sort((a, b) => a - b), end];
  const pieces: [number, number][] = [];
  for (let index = 0; index + 1 < bounds.length; index++) {
    if (bounds[index + 1] > bounds[index]) pieces.push([bounds[index], bounds[index + 1]]);
  }
  return pieces;
}

function leafCost(
  person: Person,
  intervals: RateInterval[],
  segments: AllocationSegment[],
  calendar: WorkingCalendar,
): TaskCost {
  let amount = 0;
  let costedDays = 0;
  let uncostedDays = 0;
  const applied = new Set<number>();
  for (const segment of segments) {
    for (const [from, to] of piecesOf(segment, intervals)) {
      // Person-days, not elapsed days: a half-time person on a task spread over
      // eight days still owes four days of money.
      const personDays = calendar.minutesToDays(segment.rate * (to - from));
      const rate = rateAt(person, intervals, from);
      if (rate === undefined) {
        uncostedDays += personDays;
        continue;
      }
      amount += rate * personDays;
      costedDays += personDays;
      applied.add(rate);
    }
  }
  return { amount, costedDays, uncostedDays, dailyRates: [...applied].sort((a, b) => a - b) };
}

/**
 * The money to report for a row, or null when there was nothing to cost.
 *
 * One home for the rule: `plan.ts` and `GanttChart.tsx` both build a cost
 * figure from a `TaskCost` and must agree on when `amount` (which is `0` on a
 * fully-uncosted row) turns into "nothing to show".
 */
export function reportedCost(cost: TaskCost): number | null {
  return cost.costedDays === 0 && cost.uncostedDays > 0 ? null : cost.amount;
}

/**
 * What every row of a solved project costs, keyed by task id.
 *
 * A leaf costs its own allocation, segment by segment: the person-days the
 * schedule actually gave it, priced at the rate in force over each stretch. That
 * is what makes a task straddling a rate change cost two prices, and what keeps
 * cost in step with effort — the split cannot lose a fraction of a day, because
 * the pieces partition the segment.
 *
 * An absent rate is never zero: its person-days are reported as `uncostedDays`,
 * so a caller can show a partial sum as the lower bound it is instead of a wrong
 * total. A declared `0` is the opposite case and counts as costed.
 *
 * A summary rolls up over the same children `rollUp` uses for dates and effort
 * (`project.ts:714-715`), or the money on a row would contradict the effort
 * beside it.
 */
export function taskCosts(project: Project, solved: SolvedInputs): ReadonlyMap<string, TaskCost> {
  const { hierarchy, schedule, disabledIds, calendar } = solved;
  const costs = new Map<string, TaskCost>();
  const intervalsByPerson = new Map<string, RateInterval[]>();
  const intervalsFor = (person: Person): RateInterval[] => {
    const known = intervalsByPerson.get(person.id);
    if (known) return known;
    const fresh = rateIntervals(person, calendar);
    intervalsByPerson.set(person.id, fresh);
    return fresh;
  };

  // Post-order, so a summary always finds its children already priced.
  const walk = (parentId: string | undefined): void => {
    for (const task of hierarchy.childrenOf(parentId)) {
      walk(task.id);
      const children = hierarchy.childrenOf(task.id);
      if (children.length > 0) {
        const known = children.filter((child) => costs.has(child.id));
        const live = known.filter((child) => !disabledIds.has(child.id));
        const counted = (live.length > 0 ? live : known).map((child) => costs.get(child.id)!);
        costs.set(task.id, {
          amount: counted.reduce((total, cost) => total + cost.amount, 0),
          costedDays: counted.reduce((total, cost) => total + cost.costedDays, 0),
          uncostedDays: counted.reduce((total, cost) => total + cost.uncostedDays, 0),
          // Many people, no single figure to show.
          dailyRates: [],
        });
        continue;
      }

      const scheduled = schedule.tasks.get(task.id);
      if (!scheduled) {
        costs.set(task.id, { amount: 0, costedDays: 0, uncostedDays: 0, dailyRates: [] });
        continue;
      }
      // The model's resourceId, never the engine's: a disabled leaf goes in
      // unassigned so it takes nobody's capacity, but it is still that person's
      // money.
      const person = project.resources.find((entry) => entry.id === task.resourceId);
      if (!person) {
        costs.set(task.id, {
          amount: 0,
          costedDays: 0,
          // The conserved figure itself, rather than a sum over segments nobody prices.
          uncostedDays: calendar.minutesToDays(scheduled.effortMinutes),
          dailyRates: [],
        });
        continue;
      }
      costs.set(task.id, leafCost(person, intervalsFor(person), scheduled.segments, calendar));
    }
  };
  walk(undefined);
  return costs;
}
