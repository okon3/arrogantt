import {
  dayIndexOf,
  dayIndexOfString,
  dayStringOf,
  isDayString,
  type ScheduledTask,
  type ShareOverride,
  type WorkingCalendar,
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

/** The smallest share that is not a pause: below it a task stretches past any date. */
export const MIN_SHARE = 0.01;
const TOO_SMALL = 'a share below 1% is not allowed (0 in a period pauses the task)';

/**
 * The one gate on a task's share settings: the file parser, the agent API and
 * the task dialog all come through here, and Save re-parses what it wrote.
 *
 * Throws with a user-facing message; answers the normal form — no `share` when
 * not fixed, no `shareOverrides` when empty — so one state has one spelling.
 *
 * Two periods of one task may not share a day (adjacent is fine): a period is
 * then what the bar shows on its days, with no ordering rule behind it.
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
    if (share < MIN_SHARE) throw new Error(`Invalid share: ${TOO_SMALL}`);
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
      if (value !== 0 && value < MIN_SHARE) throw new Error(`${period}: ${TOO_SMALL}`);
      const override: ShareOverride = { from, to, share: value };
      if (typeof label === 'string' && label.length > 0) override.label = label;
      return override;
    });
    // Sorted by start, any overlap in the list shows up between two neighbours.
    const byStart = periods
      .map((period, index) => ({ period, number: index + 1 }))
      .sort((a, b) => (a.period.from < b.period.from ? -1 : a.period.from > b.period.from ? 1 : 0));
    for (let position = 1; position < byStart.length; position++) {
      const pair = [byStart[position - 1], byStart[position]];
      if (pair[1].period.from > pair[0].period.to) continue;
      const [first, second] = pair.sort((a, b) => a.number - b.number);
      const span = ({ from, to }: ShareOverride) => (from === to ? from : `${from} to ${to}`);
      throw new Error(
        `Share periods ${first.number} and ${second.number} overlap (${span(first.period)} and ${span(second.period)}): the periods of one task may not share a day`,
      );
    }
    if (periods.length > 0) parsed.shareOverrides = periods;
  }
  return parsed;
}

const clampShare = (share: number) => Math.min(1, Math.max(MIN_SHARE, share));

/**
 * The share a new period on `day` starts at so that adding it moves nothing:
 * the one already fixed there, else what the task was solved at — its rate as
 * a fraction of what the person had to give, which is what a period at that
 * share solves back to. On a day it does not run (closed, absence, outside the
 * bar) the nearest stretch where it does answers; with no stretch at all, 1.
 *
 * Not rounded: a seed moved to a round figure would move the plan.
 */
export function seedShare(
  task: TaskShare,
  scheduled: ScheduledTask | undefined,
  day: number,
  calendar: Pick<WorkingCalendar, 'dayStartInWorkingMinutes'>,
): number {
  const fixed = shareOnDay(task, dayStringOf(day));
  if (fixed !== undefined) return fixed;
  const from = calendar.dayStartInWorkingMinutes(day);
  const to = calendar.dayStartInWorkingMinutes(day + 1);
  // Where no share is fixed `soloRate` is the person's capacity, recorded by
  // the engine: nothing here resolves a calendar or an availability again.
  const fraction = (segment: ScheduledTask['segments'][number]) =>
    shareOnDay(task, dayStringOf(dayIndexOf(segment.start))) ?? segment.rate / segment.soloRate;
  const running = (scheduled?.segments ?? []).filter(
    (segment) => segment.rate > 0 && segment.soloRate > 0,
  );
  let minutes = 0;
  let work = 0;
  let nearest: { distance: number; share: number } | undefined;
  for (const segment of running) {
    const overlap =
      Math.min(segment.endWorkingMinutes, to) - Math.max(segment.startWorkingMinutes, from);
    if (overlap > 0) {
      minutes += overlap;
      work += overlap * (segment.rate / segment.soloRate);
      continue;
    }
    const distance = Math.max(from - segment.endWorkingMinutes, segment.startWorkingMinutes - to, 0);
    if (!nearest || distance < nearest.distance) nearest = { distance, share: fraction(segment) };
  }
  if (minutes > 0) return clampShare(work / minutes);
  return nearest ? clampShare(nearest.share) : 1;
}

/**
 * The period every way of adding one starts from — a double-click on the bar,
 * the dialog's *Add period*, the row menu: one day, at `seedShare`.
 */
export function seededSharePeriod(
  task: TaskShare,
  scheduled: ScheduledTask | undefined,
  day: string,
  calendar: Pick<WorkingCalendar, 'dayStartInWorkingMinutes'>,
): ShareOverride {
  return { from: day, to: day, share: seedShare(task, scheduled, dayIndexOfString(day), calendar) };
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

function shareOnDay(task: TaskShare, day: string): number | undefined {
  const period = (task.shareOverrides ?? []).find(
    (candidate) => candidate.from <= day && day <= candidate.to,
  );
  return period ? period.share : task.share;
}

/** The share fixed on the day `date` falls on, or undefined: its period's, else the default. */
export function shareInForce(task: TaskShare, date: Date): number | undefined {
  return shareOnDay(task, dayStringOf(dayIndexOf(date)));
}
