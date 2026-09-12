import { isDayString, type CalendarSpec, type DailyWindow } from '../scheduler';

/**
 * The rules of the project calendar, with no form and no file around them.
 *
 * `CalendarDialog`, the agent API and the file parser all go through here.
 * `WorkingCalendar` defends itself against an empty week and an empty day and
 * against nothing else. What gets past it fails in three ways: a `NaN`
 * capacity, which stalls the scheduler; an unbounded search for the first
 * working day, which hangs the tab rather than throwing; and — the quiet one,
 * and the reason the bounds below are not defensive noise — a schedule that is
 * merely wrong, with no symptom at all. None of the three names the calendar,
 * and all happen long after the write was accepted.
 *
 * Minutes from midnight are the unit the model and the file format hold; the
 * clock strings a script reaches for are refused, never converted.
 */

const MINUTES_PER_DAY = 24 * 60;

/** A holiday as it arrives, before anything has looked at its endpoints. */
interface UncheckedDayRange {
  from?: unknown;
  to?: unknown;
}

function asList(value: unknown): unknown[] | null {
  return Array.isArray(value) ? (value as unknown[]) : null;
}

function show(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}

function clock(window: DailyWindow): string {
  return `${show(window.from)}..${show(window.to)}`;
}

/**
 * Whole minutes only: the calendar splits a bound back into hours and minutes
 * to build a `Date`, and that split truncates — a fractional bound would land
 * on a different instant than the one summed into `minutesPerDay`.
 */
function isMinuteOfDay(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MINUTES_PER_DAY
  );
}

/**
 * The first thing wrong with the calendar, or null.
 *
 * The message is user-facing English: it reaches the dialog's error line, the
 * `Error` an agent gets back and the `ProjectFileError` of a refused file.
 */
export function validateCalendar(calendar: CalendarSpec): string | null {
  if (typeof calendar !== 'object' || calendar === null) {
    return 'A calendar is an object with "workingDays" and "windows"';
  }

  const workingDays = asList(calendar.workingDays);
  if (!workingDays) return 'The calendar needs a "workingDays" list';
  if (workingDays.length === 0) return 'At least one working day a week is required';
  const seenDays = new Set<number>();
  for (const day of workingDays) {
    // Outside 0..6 no weekday can ever match, so the constructor's walk to the
    // first working day runs forever: an unresponsive tab, not an exception.
    if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6) {
      return `Invalid "workingDays" entry ${show(day)}: expected a weekday index 0..6, 0 = Sunday`;
    }
    // The engine's Set would swallow the repeat and schedule correctly. Refused
    // anyway: nothing this app writes repeats a weekday, so a repeat is a
    // hand-edit slip worth surfacing rather than absorbing.
    if (seenDays.has(day)) return `Duplicate "workingDays" entry: ${day}`;
    seenDays.add(day);
  }

  const windows = asList(calendar.windows);
  if (!windows) return 'The calendar needs a "windows" list';
  if (windows.length === 0) return 'At least one working window a day is required';
  for (const entry of windows) {
    if (typeof entry !== 'object' || entry === null) {
      return `Invalid "windows" entry ${show(entry)}: expected { from, to } in minutes from midnight`;
    }
    const window = entry as DailyWindow;
    if (!isMinuteOfDay(window.from) || !isMinuteOfDay(window.to)) {
      return `Invalid "windows" entry ${clock(window)}: "from" and "to" are whole minutes from midnight, 0..1440`;
    }
    if (window.from >= window.to) {
      return `Invalid "windows" entry ${clock(window)}: "from" must come before "to"`;
    }
  }

  // `minutesPerDay` is a plain sum, so an overlap inflates the capacity of every
  // day in the project and the schedule stops conserving effort. Declaration
  // order is not a rule — the calendar sorts — so the comparison sorts too.
  const ordered = [...(windows as DailyWindow[])].sort((a, b) => a.from - b.from);
  for (let index = 1; index < ordered.length; index++) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (current.from < previous.to) {
      return `Overlapping "windows" ${clock(previous)} and ${clock(current)}: the overlap would be counted twice`;
    }
  }

  if (calendar.holidays !== undefined) {
    const holidays = asList(calendar.holidays);
    if (!holidays) return 'The calendar needs a "holidays" list';
    for (const entry of holidays) {
      const range = typeof entry === 'object' && entry !== null ? (entry as UncheckedDayRange) : null;
      if (!range || !range.from || !range.to) {
        return 'Every shutdown needs a start date and an end date';
      }
      // `expandRanges` skips a malformed endpoint instead of failing, so a typo
      // would read as a shutdown that quietly covers nothing.
      if (!isDayString(range.from) || !isDayString(range.to)) {
        const malformed = isDayString(range.from) ? range.to : range.from;
        return `A shutdown has a malformed date ${show(malformed)}: expected YYYY-MM-DD`;
      }
    }
  }

  return null;
}
