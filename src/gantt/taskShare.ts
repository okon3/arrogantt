import {
  dayIndexOf,
  dayIndexOfString,
  dayStringOf,
  isDayString,
  type ShareOverride,
} from '../scheduler';

/**
 * A leaf's pace: the exact share of its person's capacity it runs at, by
 * default and for chosen periods. The per-task twin of a person's
 * `availability` / `availabilityOverrides`, in the same unit — a fraction in
 * the model and the file, a percentage only in the form.
 */
export interface TaskShare {
  share?: number;
  shareOverrides?: ShareOverride[];
}

const isRealDay = (value: unknown): value is string =>
  isDayString(value) && dayStringOf(dayIndexOfString(value)) === value;

const isFraction = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/**
 * The one gate on a task's share settings: the file parser, the agent API and
 * the task dialog all come through here, and Save re-parses what it wrote.
 *
 * Throws with a user-facing message; answers the normal form — no `share` when
 * not fixed, no `shareOverrides` when empty — so one state has one spelling.
 */
export function parseTaskShare(share: unknown, overrides: unknown): TaskShare {
  const parsed: TaskShare = {};
  if (share !== undefined) {
    // A default of zero never finishes: the scheduler would stall on it.
    if (share === 0) {
      throw new Error('A share of 0 would never finish the task: pause it with a period at 0 instead');
    }
    if (!isFraction(share)) {
      throw new Error('Invalid share: expected a number above 0 and up to 1 (100%)');
    }
    parsed.share = share;
  }
  if (overrides !== undefined) {
    if (!Array.isArray(overrides)) throw new Error('shareOverrides: expected a list of periods');
    const periods = overrides.map((entry: unknown, index) => {
      const period = `Share period ${index + 1}`;
      if (typeof entry !== 'object' || entry === null) {
        throw new Error(`${period}: expected { from, to, share }`);
      }
      const { from, to, share: value, label } = entry as Record<string, unknown>;
      if (!from || !to) throw new Error(`${period} has no start or end`);
      if (!isRealDay(from) || !isRealDay(to)) {
        throw new Error(`${period} has a malformed date: expected YYYY-MM-DD`);
      }
      if (from > to) throw new Error(`${period} ends before it starts`);
      if (!isFraction(value)) {
        throw new Error(`${period} needs a numeric "share", 0 (paused) to 1`);
      }
      const override: ShareOverride = { from, to, share: value };
      if (typeof label === 'string' && label.length > 0) override.label = label;
      return override;
    });
    if (periods.length > 0) parsed.shareOverrides = periods;
  }
  return parsed;
}

/** The settings as a copy to hand out, or nothing where they are `inert`: a summary, a milestone. */
export function leafShare(task: TaskShare, inert: boolean): TaskShare {
  if (inert) return {};
  return {
    ...(task.share === undefined ? {} : { share: task.share }),
    ...(task.shareOverrides === undefined
      ? {}
      : { shareOverrides: task.shareOverrides.map((period) => ({ ...period })) }),
  };
}

export function hasShare(task: TaskShare): boolean {
  return task.share !== undefined || task.shareOverrides !== undefined;
}

/** The share fixed on the day `date` falls on, or undefined: last declared period wins, else the default. */
export function shareInForce(task: TaskShare, date: Date): number | undefined {
  const day = dayStringOf(dayIndexOf(date));
  const period = (task.shareOverrides ?? []).findLast(
    (candidate) => candidate.from <= day && day <= candidate.to,
  );
  return period ? period.share : task.share;
}
