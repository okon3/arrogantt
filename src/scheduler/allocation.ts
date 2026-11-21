import type { Resource, TaskId } from './types';

export interface AllocationCandidate {
  id: TaskId;
  /** Man-minutes still to burn. */
  remaining: number;
  /**
   * The exact share of `capacity` the task runs at right now, 0 to 1, when one
   * is fixed. Already resolved for this stretch of time, like `capacity`: the
   * periods it came from are the loop's business, never the policy's.
   */
  share?: number;
}

export interface AllocationRequest {
  /** Absent for the pool of unassigned tasks, which never contend. */
  resource: Resource | undefined;
  /**
   * Capacity available for this stretch of time, already accounting for the
   * resource's availability and any absence in progress — so a policy never has
   * to know about days off. Zero means the resource cannot work right now.
   */
  capacity: number;
  candidates: AllocationCandidate[];
}

/**
 * Decides how much of a resource each concurrently active task receives.
 *
 * Rates are fractions of a full-time resource, so 0.5 means the task burns one
 * man-minute every two working minutes. A policy sees one instant: capacity and
 * each candidate's fixed share arrive resolved, so it never reads a calendar or
 * a date. A task missing from the answer does not run.
 */
export type AllocationPolicy = (request: AllocationRequest) => Map<TaskId, number>;

/**
 * Float drift below which what the fixed shares leave counts as none. Measured
 * on the shares, not on the capacity they divide: a person with any capacity
 * anchors a task, so that capacity has to be granted too.
 */
const NOTHING_LEFT = 1e-9;

/**
 * Fixed shares first, then an even split of what they leave — which is what
 * makes two concurrent tasks run at 50%.
 *
 * A fixed share is exact rather than a cap, so capacity nobody else claims
 * stays free. Shares adding up to more than the whole are scaled down in
 * proportion, and a task with no share of its own then stops — as it does when
 * they add up to exactly the whole.
 */
export const splitCapacity: AllocationPolicy = ({ capacity, candidates }) => {
  const rates = new Map<TaskId, number>();
  if (capacity <= 0) return rates;
  const fixed = candidates.filter((candidate) => candidate.share !== undefined);
  const claimed = fixed.reduce((sum, candidate) => sum + candidate.share!, 0);
  const scale = claimed > 1 ? 1 / claimed : 1;
  for (const candidate of fixed) {
    if (candidate.share! > 0) rates.set(candidate.id, candidate.share! * scale * capacity);
  }
  const unfixed = candidates.length - fixed.length;
  const left = 1 - claimed;
  if (unfixed === 0 || left <= NOTHING_LEFT) return rates;
  for (const candidate of candidates) {
    if (candidate.share === undefined) rates.set(candidate.id, (left * capacity) / unfixed);
  }
  return rates;
};
