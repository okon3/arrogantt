import {
  dayIndexOf,
  dayIndexOfString,
  dayStringOf,
  dayZeroStart,
  isDayString,
  type DayRange,
  type ScheduledTask,
  type ShareOverride,
  type WorkingCalendar,
} from '../scheduler';

/**
 * A leaf's pace: the exact share of its person's capacity it runs at, by
 * default and for chosen periods. The per-task twin of a person's
 * `availability` / `availabilityOverrides`, in the same unit — a fraction in
 * the model and the file, a percentage only in the form. Unlike a person's,
 * its periods are days of the task, not of the calendar: they move with it.
 */
export interface TaskShare {
  share?: number;
  shareOverrides?: ShareOverride[];
}

const isFraction = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** The smallest share that is not a pause: below it a task stretches past any date. */
export const MIN_SHARE = 0.01;
const TOO_SMALL = 'a share below 1% is not allowed (0 in a period pauses the task)';

/** Past this a pause would date the task's end beyond what a `Date` holds. */
export const MAX_PERIOD_DAY = 10_000;

const isPeriodDay = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_PERIOD_DAY;

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
        throw new Error(`${period}: expected { fromDay, toDay, share }`);
      }
      const { fromDay, toDay, share: value, label } = entry as Record<string, unknown>;
      if ('from' in entry || 'to' in entry) {
        throw new Error(
          `${period} is dated ("from"/"to"): periods are now day offsets from the task's start — { fromDay, toDay, share }, day 0 being the task's first working day`,
        );
      }
      if (!isPeriodDay(fromDay) || !isPeriodDay(toDay)) {
        throw new Error(
          `${period} needs whole "fromDay" and "toDay": working days of the task, 0 (its first) to ${MAX_PERIOD_DAY}`,
        );
      }
      if (fromDay > toDay) throw new Error(`${period} ends before it starts`);
      if (!isFraction(value)) {
        throw new Error(`${period} needs a numeric "share", 0 (paused) to 1`);
      }
      if (value !== 0 && value < MIN_SHARE) throw new Error(`${period}: ${TOO_SMALL}`);
      const override: ShareOverride = { fromDay, toDay, share: value };
      if (typeof label === 'string' && label.length > 0) override.label = label;
      return override;
    });
    // Sorted by start, any overlap in the list shows up between two neighbours.
    const byStart = periods
      .map((period, index) => ({ period, number: index + 1 }))
      .sort((a, b) => a.period.fromDay - b.period.fromDay);
    for (let position = 1; position < byStart.length; position++) {
      const pair = [byStart[position - 1], byStart[position]];
      if (pair[1].period.fromDay > pair[0].period.toDay) continue;
      const [first, second] = pair.sort((a, b) => a.number - b.number);
      const span = ({ fromDay, toDay }: ShareOverride) =>
        fromDay === toDay ? `day ${fromDay}` : `days ${fromDay} to ${toDay}`;
      throw new Error(
        `Share periods ${first.number} and ${second.number} overlap (${span(first.period)} and ${span(second.period)}): the periods of one task may not share a day`,
      );
    }
    if (periods.length > 0) parsed.shareOverrides = periods;
  }
  return parsed;
}

/**
 * A task's working days as its periods count them, read off the plan it was
 * solved in. Days are calendar day indices, ordinals count from the task's
 * day 0; every answer goes through working minutes, so a closed day is never
 * counted here either.
 */
export interface TaskDays {
  /** The ordinal of the working day the task ends on. */
  last: number;
  /** The calendar day working day `ordinal` falls on. */
  dayOf(ordinal: number): number;
  /**
   * The first of the task's working days on or after `day`. Before day 0 it is
   * never above 0, and no further back than the plan's first day: the axis
   * ends there.
   */
  ordinalFrom(day: number): number;
  /** Which of the task's working days `day` is; undefined on a closed day or before day 0. */
  ordinalOf(day: number): number | undefined;
  /** As `ordinalOf`, a closed day answering the working day nearest to it; undefined outside the task. */
  nearestOrdinal(day: number): number | undefined;
  /** The working day a working minute falls in. */
  ordinalAt(workingMinutes: number): number;
}

export function taskDays(
  scheduled: Pick<ScheduledTask, 'startWorkingMinutes' | 'endWorkingMinutes'>,
  calendar: WorkingCalendar,
): TaskDays {
  const perDay = calendar.minutesPerDay;
  const zero = dayZeroStart(scheduled.startWorkingMinutes, perDay);
  // An end on a day boundary closes the day before it.
  const last = Math.max(0, Math.ceil((scheduled.endWorkingMinutes - zero) / perDay) - 1);
  const dayOf = (ordinal: number) =>
    dayIndexOf(calendar.fromWorkingMinutes(zero + ordinal * perDay, 'start'));
  // A closed day collapses onto the opening of the next working one.
  const ordinalFrom = (day: number) => (calendar.dayStartInWorkingMinutes(day) - zero) / perDay;
  const ordinalOf = (day: number) => {
    const ordinal = ordinalFrom(day);
    return ordinalFrom(day + 1) > ordinal && ordinal >= 0 ? ordinal : undefined;
  };
  return {
    last,
    dayOf,
    ordinalFrom,
    ordinalOf,
    nearestOrdinal: (day) => {
      if (day < dayOf(0) || day > dayOf(last)) return undefined;
      const exact = ordinalOf(day);
      if (exact !== undefined) return exact;
      // Inside the task a closed day has a working day of the task on both sides.
      const next = ordinalFrom(day);
      return dayOf(next) - day < day - dayOf(next - 1) ? next : next - 1;
    },
    ordinalAt: (workingMinutes) => Math.floor((workingMinutes - zero) / perDay),
  };
}

/**
 * The periods as they may stand on a task whose last working day is `last`:
 * none reaches past it, and one starting after it is dropped. Days past a
 * task's end are inert, so this never moves the schedule it was read from.
 * Answers the list itself when nothing reaches past.
 */
export function trimToTask(periods: ShareOverride[], last: number): ShareOverride[] {
  if (periods.every((period) => period.toDay <= last)) return periods;
  return periods.flatMap((period) =>
    period.fromDay > last ? [] : [period.toDay > last ? { ...period, toDay: last } : period],
  );
}

/** A period on the dates the plan currently puts it: what a form shows, never what is stored. */
export type DatedSharePeriod = DayRange & { share: number };

export function datePeriods(periods: ShareOverride[], days: TaskDays): DatedSharePeriod[] {
  return periods.map(({ fromDay, toDay, ...rest }) => ({
    from: dayStringOf(days.dayOf(fromDay)),
    to: dayStringOf(days.dayOf(toDay)),
    ...rest,
  }));
}

const isRealDay = (value: unknown): value is string =>
  isDayString(value) && dayStringOf(dayIndexOfString(value)) === value;

/**
 * Dated periods back as days of the task: the inverse of `datePeriods` on the
 * same plan. A closed day at either end gives way to the working day inside
 * the period. Throws with a user-facing message; `parseTaskShare` still has to
 * pass what comes out.
 */
export function undatePeriods(dated: DatedSharePeriod[], days: TaskDays): ShareOverride[] {
  return dated.map(({ from, to, ...rest }, index) => {
    const period = `Share period ${index + 1}`;
    if (!from || !to) throw new Error(`${period} has no start or end`);
    if (!isRealDay(from) || !isRealDay(to)) {
      throw new Error(`${period} has a malformed date: expected YYYY-MM-DD`);
    }
    if (from > to) throw new Error(`${period} ends before it starts`);
    // By the date, not the ordinal: the axis has no day before the plan's first.
    if (dayIndexOfString(from) < days.dayOf(0)) {
      throw new Error(
        `${period} starts before the task does (${dayStringOf(days.dayOf(0))}): a period is days of the task, and moves with it`,
      );
    }
    const fromDay = days.ordinalFrom(dayIndexOfString(from));
    const toDay = days.ordinalFrom(dayIndexOfString(to) + 1) - 1;
    if (toDay < fromDay) throw new Error(`${period} covers no working day`);
    return { fromDay, toDay, ...rest };
  });
}

const clampShare = (share: number) => Math.min(1, Math.max(MIN_SHARE, share));

/**
 * The share a new period on the task's working day `ordinal` starts at so that
 * adding it moves nothing: the one already fixed there, else what the task was
 * solved at — its rate as a fraction of what the person had to give, which is
 * what a period at that share solves back to. On a day it does not run
 * (absence, past its end) the nearest stretch where it does answers; with no
 * stretch at all, 1.
 *
 * Not rounded: a seed moved to a round figure would move the plan.
 */
export function seedShare(
  task: TaskShare,
  scheduled: ScheduledTask | undefined,
  ordinal: number,
  minutesPerDay: number,
): number {
  const fixed = shareOnDay(task, ordinal);
  if (fixed !== undefined) return fixed;
  if (!scheduled) return 1;
  const zero = dayZeroStart(scheduled.startWorkingMinutes, minutesPerDay);
  const from = zero + ordinal * minutesPerDay;
  const to = from + minutesPerDay;
  // Where no share is fixed `soloRate` is the person's capacity, recorded by
  // the engine: nothing here resolves a calendar or an availability again.
  const fraction = (segment: ScheduledTask['segments'][number]) =>
    shareOnDay(task, Math.floor((segment.startWorkingMinutes - zero) / minutesPerDay)) ??
    segment.rate / segment.soloRate;
  const running = scheduled.segments.filter((segment) => segment.rate > 0 && segment.soloRate > 0);
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
  ordinal: number,
  minutesPerDay: number,
): ShareOverride {
  return {
    fromDay: ordinal,
    toDay: ordinal,
    share: seedShare(task, scheduled, ordinal, minutesPerDay),
  };
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

/** The share fixed on the task's working day `ordinal`, or undefined: its period's, else the default. */
export function shareOnDay(task: TaskShare, ordinal: number): number | undefined {
  const period = (task.shareOverrides ?? []).find(
    (candidate) => candidate.fromDay <= ordinal && ordinal <= candidate.toDay,
  );
  return period ? period.share : task.share;
}
