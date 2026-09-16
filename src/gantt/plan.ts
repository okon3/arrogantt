import { reportedCost } from './cost';
import { serializeDate } from './dates';
import { isContended } from '../scheduler';
import type { SolvedProject } from './project';

/**
 * One task as a script reads it.
 *
 * `segments` are deliberately absent: they exist to draw a bar, and `shared`
 * answers the same question — was this stretched by contention — at a fraction
 * of the size.
 */
export interface PlanTask {
  id: string;
  name: string;
  /** The only structural truth. Null at top level. */
  parentId: string | null;
  /** Derived from `parentId` for printing an outline. Carries no information. */
  depth: number;
  /** Has children, so its figures are rolled up and it is never scheduled. */
  isSummary: boolean;
  /** `YYYY-MM-DDTHH:mm`, local wall clock. */
  start: string;
  /** Equal to `start` on a task with no effort, which spans nothing. */
  end: string;
  /** Declared effort on a leaf, the rollup of the leaves on a summary. */
  effortDays: number;
  /** Working days actually spanned; exceeds `effortDays` below full rate. */
  elapsedDays: number;
  /**
   * The stretching came from splitting a resource with another task, not from
   * part-time or absence. `segmentBar`'s own notion of shared is a different
   * question — it asks whether there is a profile worth drawing at all.
   */
  shared: boolean;
  /**
   * Not committed work: positioned, but taking no capacity, no part in the
   * roll-up above it and none in the critical chain. True on a summary once
   * every leaf under it is disabled.
   */
  disabled: boolean;
  resourceId: string | null;
  predecessors: string[];
  /**
   * Money over the costed part of its effort. Null when there was nothing to
   * cost — no rate priced any of it — which is a different statement from `0`:
   * a milestone has no effort to leave uncosted, so it costs `0`.
   */
  cost: number | null;
  /** Person-days no rate priced: what `cost` leaves out. */
  uncostedDays: number;
  /**
   * The distinct rates this row was paid, ascending: one figure, or the pair a
   * task straddling a rate change owes. Empty on a summary, which has as many
   * rates as it has people, and wherever nothing was priced.
   */
  dailyRates: number[];
}

export interface Plan {
  projectStart: string;
  projectEnd: string;
  /**
   * The roll-up of the **top-level rows that carry committed work**, not the sum
   * of every row: a summary already holds its children, and a placeholder
   * weighs nothing in a total, exactly as its effort does not.
   *
   * Null when nothing in the plan was costed, which is what a caller shows
   * nothing for — an empty plan has no figure, where a milestone row has `0`.
   */
  totalCost: number | null;
  /** Person-days `totalCost` leaves out, rolled up the same way. */
  uncostedDays: number;
  /** The label to print beside the money, or none. */
  currency: string | null;
  tasks: PlanTask[];
}

/**
 * The solved project as a snapshot two calls apart can be diffed row by row.
 *
 * The order is the tree's — a parent immediately precedes its own subtree,
 * recursively — walked from the hierarchy rather than read off `project.tasks`,
 * whose order does not follow the tree. Without that stability the diff between
 * a before and an after, which is the whole point of this shape, is noise.
 */
export function buildPlan(solved: SolvedProject): Plan {
  const { hierarchy, schedule, summaryIds, disabledIds, calendar } = solved;
  const tasks: PlanTask[] = [];

  // Priced by the same walk over the same hierarchy, so every row this one
  // reaches is in the map.
  const costOf = (id: string) => solved.costs.get(id)!;

  const walk = (parentId: string | undefined, depth: number) => {
    for (const task of hierarchy.childrenOf(parentId)) {
      const scheduled = schedule.tasks.get(task.id);
      const cost = costOf(task.id);
      tasks.push({
        id: task.id,
        name: task.name,
        parentId: parentId ?? null,
        depth,
        isSummary: summaryIds.has(task.id),
        start: serializeDate(scheduled?.start ?? task.start),
        end: serializeDate(scheduled?.end ?? task.start),
        effortDays: scheduled ? calendar.minutesToDays(scheduled.effortMinutes) : task.nominalDays,
        elapsedDays: scheduled ? calendar.minutesToDays(scheduled.elapsedWorkingMinutes) : 0,
        shared: scheduled ? isContended(scheduled) : false,
        disabled: disabledIds.has(task.id),
        resourceId: summaryIds.has(task.id) ? null : task.resourceId ?? null,
        predecessors: [...(task.predecessors ?? [])],
        cost: reportedCost(cost),
        uncostedDays: cost.uncostedDays,
        dailyRates: [...cost.dailyRates],
      });
      walk(task.id, depth + 1);
    }
  };
  walk(undefined, 0);

  // The roll-up excludes a disabled child, but a top-level row has no summary
  // above it to apply that rule, so the total applies it itself.
  const roots = hierarchy
    .childrenOf(undefined)
    .filter((task) => !disabledIds.has(task.id))
    .map((task) => costOf(task.id));
  const costedDays = roots.reduce((total, cost) => total + cost.costedDays, 0);

  return {
    projectStart: serializeDate(schedule.projectStart),
    projectEnd: serializeDate(schedule.projectEnd),
    totalCost: costedDays === 0 ? null : roots.reduce((total, cost) => total + cost.amount, 0),
    uncostedDays: roots.reduce((total, cost) => total + cost.uncostedDays, 0),
    currency: solved.currency,
    tasks,
  };
}
