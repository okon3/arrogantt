import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR, WorkingCalendar, type CalendarSpec } from '../scheduler';
import { validateCalendar } from './calendarRules';

const calendar = (patch: Partial<CalendarSpec> = {}): CalendarSpec => ({
  workingDays: [1, 2, 3, 4, 5],
  windows: [{ from: 8 * 60, to: 17 * 60 }],
  ...patch,
});

describe('validateCalendar', () => {
  it('accepts a plain calendar', () => {
    expect(validateCalendar(calendar())).toBeNull();
  });

  it('accepts the default the app ships', () => {
    expect(validateCalendar(DEFAULT_CALENDAR)).toBeNull();
  });

  it('accepts a split day, the two halves touching', () => {
    // 8-12 / 12-17: adjacent is not overlapping.
    expect(
      validateCalendar(
        calendar({
          windows: [
            { from: 8 * 60, to: 12 * 60 },
            { from: 12 * 60, to: 17 * 60 },
          ],
        }),
      ),
    ).toBeNull();
  });

  it('accepts windows declared out of order, as the calendar sorts them', () => {
    expect(
      validateCalendar(
        calendar({
          windows: [
            { from: 13 * 60, to: 17 * 60 },
            { from: 8 * 60, to: 12 * 60 },
          ],
        }),
      ),
    ).toBeNull();
  });

  it('refuses a week with no working day', () => {
    // The dialog's own message, now that the rule lives here.
    expect(validateCalendar(calendar({ workingDays: [] }))).toBe(
      'At least one working day a week is required',
    );
  });

  it('refuses a weekday index outside 0..6', () => {
    expect(validateCalendar(calendar({ workingDays: [1, 7] }))).toMatch(/"workingDays" entry 7/);
  });

  it('refuses a fractional weekday index', () => {
    expect(validateCalendar(calendar({ workingDays: [1.5] }))).toMatch(/"workingDays"/);
  });

  it('refuses a repeated weekday', () => {
    expect(validateCalendar(calendar({ workingDays: [1, 1] }))).toBe(
      'Duplicate "workingDays" entry: 1',
    );
  });

  it('refuses workingDays that is not a list', () => {
    // The second probe file: "weekdays" as a Set is eight characters no weekday
    // ever matches, and the calendar walks forward forever looking for one.
    const spec = { workingDays: 'weekdays', windows: [{ from: 480, to: 1020 }] };
    expect(validateCalendar(spec as unknown as CalendarSpec)).toBe(
      'The calendar needs a "workingDays" list',
    );
  });

  it('refuses clock strings in a window', () => {
    // The first probe file: the strings sum to a NaN capacity and the
    // simulation stops advancing — "Scheduler stalled", no mention of hours.
    const spec = { workingDays: [1, 2, 3, 4, 5], windows: [{ from: '08:00', to: '17:00' }] };
    expect(validateCalendar(spec as unknown as CalendarSpec)).toMatch(
      /"windows" entry "08:00"\.\."17:00"/,
    );
  });

  it('refuses a day with no working window', () => {
    expect(validateCalendar(calendar({ windows: [] }))).toBe(
      'At least one working window a day is required',
    );
  });

  it('refuses a window past midnight', () => {
    expect(validateCalendar(calendar({ windows: [{ from: 8 * 60, to: 1441 }] }))).toMatch(
      /0\.\.1440/,
    );
  });

  it('refuses a window that ends before it starts', () => {
    expect(validateCalendar(calendar({ windows: [{ from: 17 * 60, to: 8 * 60 }] }))).toMatch(
      /"from" must come before "to"/,
    );
  });

  it('refuses a window of zero length', () => {
    expect(validateCalendar(calendar({ windows: [{ from: 480, to: 480 }] }))).toMatch(
      /"from" must come before "to"/,
    );
  });

  it('refuses overlapping windows', () => {
    expect(
      validateCalendar(
        calendar({
          windows: [
            { from: 8 * 60, to: 13 * 60 },
            { from: 12 * 60, to: 17 * 60 },
          ],
        }),
      ),
    ).toMatch(/Overlapping "windows"/);
  });

  it('refuses an overlap however the windows are ordered', () => {
    expect(
      validateCalendar(
        calendar({
          windows: [
            { from: 12 * 60, to: 17 * 60 },
            { from: 8 * 60, to: 13 * 60 },
          ],
        }),
      ),
    ).toMatch(/Overlapping "windows"/);
  });

  it('refuses a window swallowed by another', () => {
    expect(
      validateCalendar(
        calendar({
          windows: [
            { from: 8 * 60, to: 17 * 60 },
            { from: 9 * 60, to: 10 * 60 },
          ],
        }),
      ),
    ).toMatch(/Overlapping "windows"/);
  });

  it('accepts a shutdown', () => {
    expect(
      validateCalendar(calendar({ holidays: [{ from: '2026-08-10', to: '2026-08-21' }] })),
    ).toBeNull();
  });

  it('refuses a shutdown missing one of its ends', () => {
    // The dialog's own message, now that the rule lives here.
    expect(validateCalendar(calendar({ holidays: [{ from: '2026-08-10', to: '' }] }))).toBe(
      'Every shutdown needs a start date and an end date',
    );
  });

  it('refuses a malformed shutdown date', () => {
    expect(
      validateCalendar(calendar({ holidays: [{ from: '10/08/2026', to: '2026-08-21' }] })),
    ).toBe('A shutdown has a malformed date "10/08/2026": expected YYYY-MM-DD');
  });

  it('refuses a calendar that is not an object at all', () => {
    expect(validateCalendar(null as unknown as CalendarSpec)).toMatch(/A calendar is an object/);
  });
});

describe('what the rules are worth', () => {
  it('overlapping windows inflate a day of capacity', () => {
    // Why the overlap rule is not cosmetic: 8-13 and 12-17 span nine hours, and
    // `minutesPerDay` — a plain sum — reports ten. Every task on that calendar
    // would be given an hour a day it does not have.
    const overlapping = new WorkingCalendar(new Date(2026, 0, 5), {
      workingDays: [1, 2, 3, 4, 5],
      windows: [
        { from: 8 * 60, to: 13 * 60 },
        { from: 12 * 60, to: 17 * 60 },
      ],
    });
    expect(overlapping.minutesPerDay).toBe(10 * 60);
  });

  it('clock strings make the capacity NaN, which is what stalls the scheduler', () => {
    const broken = new WorkingCalendar(new Date(2026, 0, 5), {
      workingDays: [1, 2, 3, 4, 5],
      windows: [{ from: '08:00', to: '17:00' }],
    } as unknown as CalendarSpec);
    expect(Number.isNaN(broken.minutesPerDay)).toBe(true);
  });
});
