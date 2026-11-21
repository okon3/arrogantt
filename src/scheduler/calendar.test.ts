import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR, WorkingCalendar, type CalendarSpec } from './calendar';
import { schedule } from './simulate';

const MINUTES_PER_DAY = 8 * 60;
/** Monday. */
const MONDAY = new Date(2026, 8, 7, 8, 0);
const day = (offset: number, hour = 8) => new Date(2026, 8, 7 + offset, hour, 0);

describe('working day ordinal → calendar day', () => {
  // Tue-Wed closed, then the Monday after: the estimate lands on one closure
  // and its correction lands on the next.
  const spec: CalendarSpec = {
    ...DEFAULT_CALENDAR,
    holidays: [
      { from: '2026-09-15', to: '2026-09-16' },
      { from: '2026-09-21', to: '2026-09-21' },
    ],
  };

  it('schedules a task across two separate shutdowns', () => {
    const result = schedule(
      [{ id: 'a', name: 'A', effort: 8 * MINUTES_PER_DAY, startConstraint: MONDAY }],
      [],
      { origin: MONDAY, calendar: spec },
    );
    // Mon-Fri, Mon, then Thu and Fri of the second week.
    expect(result.tasks.get('a')!.end).toEqual(day(11, 17));
  });

  it('round-trips every working day through the axis', () => {
    const calendar = new WorkingCalendar(MONDAY, spec);
    const closed = new Set([5, 6, 8, 9, 12, 13, 14, 19, 20]);
    let ordinal = 0;
    for (let offset = 0; offset < 26; offset++) {
      if (closed.has(offset)) continue;
      expect(calendar.fromWorkingMinutes(ordinal * MINUTES_PER_DAY)).toEqual(day(offset));
      expect(calendar.toWorkingMinutes(day(offset))).toBe(ordinal * MINUTES_PER_DAY);
      ordinal++;
    }
  });

  it('resolves a day past a shutdown longer than the estimate can jump', () => {
    const calendar = new WorkingCalendar(MONDAY, {
      ...DEFAULT_CALENDAR,
      holidays: [{ from: '2026-09-08', to: '2027-09-07' }],
    });
    expect(calendar.fromWorkingMinutes(MINUTES_PER_DAY)).toEqual(new Date(2027, 8, 8, 8, 0));
  });
});
