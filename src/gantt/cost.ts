import { dayIndexOfString, isDayString, type DayRange, type Resource } from '../scheduler';

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
  // Refuses rather than repairs: the parser and the API never trim on the
  // caller's behalf, so " EUR " is an error, not a currency named "EUR".
  if (label !== label.trim()) return CURRENCY_MESSAGE;
  if (label.length === 0) return CURRENCY_MESSAGE;
  if (label.length > 8) return CURRENCY_MESSAGE;
  return null;
}
