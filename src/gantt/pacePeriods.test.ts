import { describe, expect, it } from 'vitest';
import { dayIndexOfString, type ShareOverride } from '../scheduler';
import {
  NARROW_PX,
  addPeriod,
  levelShare,
  moveEdge,
  nearestMidnight,
  periodBoxes,
  removePeriod,
  samePeriods,
  setLevel,
  shareLabel,
} from './pacePeriods';
import { parseTaskShare } from './taskShare';

const day = (date: string) => dayIndexOfString(`2026-09-${date}`);
const period = (fromDay: number, toDay: number, share = 0.5, label?: string): ShareOverride => ({
  fromDay,
  toDay,
  share,
  ...(label ? { label } : {}),
});

describe('nearestMidnight', () => {
  it('snaps to the midnight the instant is closest to, not the one before it', () => {
    expect(nearestMidnight(new Date(2026, 8, 9, 0, 0))).toBe(day('09'));
    expect(nearestMidnight(new Date(2026, 8, 9, 11, 59))).toBe(day('09'));
    expect(nearestMidnight(new Date(2026, 8, 9, 12, 0))).toBe(day('10'));
    expect(nearestMidnight(new Date(2026, 8, 9, 23, 59))).toBe(day('10'));
  });
});

describe('moveEdge', () => {
  const periods = [period(2, 3, 0.5, 'Audit'), period(5, 6, 0)];

  it('moves the edge onto the day, the other edge and the rest left alone', () => {
    expect(moveEdge(periods, 0, 'to', 4)).toEqual([period(2, 4, 0.5, 'Audit'), periods[1]]);
    expect(moveEdge(periods, 0, 'from', 1)[0]).toEqual(period(1, 3, 0.5, 'Audit'));
    expect(moveEdge(periods, 0, 'to', 2)[0]).toEqual(period(2, 2, 0.5, 'Audit'));
  });

  it("stops at the task's first day, and at nothing on its far side", () => {
    expect(moveEdge(periods, 0, 'from', -3)[0].fromDay).toBe(0);
    // The task's end is the solve's to find: `trimToTask` cuts there.
    expect(moveEdge(periods, 1, 'to', 400)[1].toDay).toBe(400);
  });

  it('stops at the day beside the neighbouring period, whatever the list order', () => {
    expect(moveEdge(periods, 0, 'to', 9)[0].toDay).toBe(4);
    expect(moveEdge(periods, 1, 'from', 0)[1].fromDay).toBe(4);
    const reversed = [periods[1], periods[0]];
    expect(moveEdge(reversed, 1, 'to', 9)[1].toDay).toBe(4);
  });

  it('never hands the gate an overlap', () => {
    for (let target = -2; target <= 12; target++) {
      for (const [index, edge] of [[0, 'from'], [0, 'to'], [1, 'from'], [1, 'to']] as const) {
        expect(() => parseTaskShare(undefined, moveEdge(periods, index, edge, target))).not.toThrow();
      }
    }
  });

  it('removes its own period, and only that, once an edge passes the other', () => {
    expect(moveEdge(periods, 0, 'from', 4)).toEqual([periods[1]]);
    expect(moveEdge(periods, 0, 'to', 1)).toEqual([periods[1]]);
    // Far past the neighbour too: the neighbour is not the one being dragged.
    expect(moveEdge(periods, 0, 'from', 9)).toEqual([periods[1]]);
    expect(moveEdge(periods, 1, 'to', 1)).toEqual([periods[0]]);
  });

  it('leaves the caller’s list as it was', () => {
    const before = JSON.stringify(periods);
    moveEdge(periods, 0, 'to', 9);
    expect(JSON.stringify(periods)).toBe(before);
  });
});

describe('the level grip', () => {
  it('moves in tenths with the pointer’s rise over the bar’s height', () => {
    expect(levelShare(0.5, 0, 24)).toBe(0.5);
    expect(levelShare(0.5, 2.4, 24)).toBe(0.6);
    expect(levelShare(0.5, -7, 24)).toBe(0.2);
    expect(levelShare(0.5, 1, 24)).toBe(0.5);
  });

  it('snaps an unrounded seed to a tenth once dragged', () => {
    expect(levelShare(1 / 3, 0, 24)).toBe(0.3);
    expect(levelShare(1 / 3, 4.8, 24)).toBe(0.5);
  });

  it('stays between paused and the whole person', () => {
    expect(levelShare(0.5, 500, 24)).toBe(1);
    expect(levelShare(0.5, -500, 24)).toBe(0);
  });

  it('writes the share on its own period', () => {
    const periods = [period(2, 3), period(5, 6, 0)];
    expect(setLevel(periods, 1, 0.3)).toEqual([periods[0], period(5, 6, 0.3)]);
    expect(shareLabel(0)).toBe('paused');
    expect(shareLabel(1 / 3)).toBe('33%');
  });
});

describe('addPeriod', () => {
  const periods = [period(2, 3)];

  it('appends one day at the share it is given', () => {
    expect(addPeriod(periods, 5, 1 / 3)).toEqual([periods[0], period(5, 5, 1 / 3)]);
    expect(addPeriod([], 0, 1)).toEqual([period(0, 0, 1)]);
  });

  it('adds nothing inside a period, and says so by identity', () => {
    expect(addPeriod(periods, 2, 1)).toBe(periods);
    expect(addPeriod(periods, 3, 1)).toBe(periods);
  });

  it('takes the day beside a period', () => {
    expect(addPeriod(periods, 4, 1)).toHaveLength(2);
  });
});

describe('the list helpers', () => {
  const periods = [period(2, 3, 0.5, 'Audit'), period(5, 6, 0)];

  it('removes one period by position', () => {
    expect(removePeriod(periods, 0)).toEqual([periods[1]]);
  });

  it('compares by content, label included', () => {
    expect(samePeriods(periods, periods.map((entry) => ({ ...entry })))).toBe(true);
    expect(samePeriods(periods, [periods[0]])).toBe(false);
    expect(samePeriods(periods, setLevel(periods, 1, 0.1))).toBe(false);
    expect(samePeriods(periods, [period(2, 3, 0.5), periods[1]])).toBe(false);
    expect(samePeriods(periods, [period(2, 4, 0.5, 'Audit'), periods[1]])).toBe(false);
  });
});

describe('periodBoxes', () => {
  const rendered = { firstDay: day('07'), endDay: day('21') };
  const bar = { top: 72, height: 24, rowHeight: 36 };
  const dayX = (index: number) => (index - rendered.firstDay) * 40;
  /** A task starting on Monday the 7th, in a week without a weekend. */
  const plain = (ordinal: number) => day('07') + ordinal;
  /** The same task on a Monday-to-Friday week. */
  const weekdays = (ordinal: number) => day('07') + ordinal + 2 * Math.floor(ordinal / 5);

  it('spans its days from midnight to midnight, centred in the row like the bar', () => {
    expect(periodBoxes([period(2, 3, 0.25)], rendered, bar, dayX, plain)).toEqual([
      { index: 0, left: 80, top: 78, width: 80, height: 24, share: 0.25, tiny: false },
    ]);
  });

  it('spans the weekend between its first and last working day', () => {
    // Day 4 is Friday the 11th, day 5 Monday the 14th.
    const [box] = periodBoxes([period(4, 5)], rendered, bar, dayX, weekdays);
    expect(box).toMatchObject({ left: 160, width: 160 });
  });

  it('clips to the rendered range and skips a period outside it, keeping positions', () => {
    const earlier = (ordinal: number) => day('01') + ordinal;
    const boxes = periodBoxes(
      [period(0, 7), period(0, 4), period(18, 24)],
      rendered,
      bar,
      dayX,
      earlier,
    );
    expect(boxes.map(({ index, left, width }) => ({ index, left, width }))).toEqual([
      { index: 0, left: 0, width: 80 },
      { index: 2, left: 480, width: 80 },
    ]);
  });

  it('calls a period with no room for its handles tiny', () => {
    const narrow = (index: number) => (index - rendered.firstDay) * (NARROW_PX - 1);
    expect(periodBoxes([period(2, 2)], rendered, bar, narrow, plain)[0].tiny).toBe(true);
    expect(periodBoxes([period(2, 3)], rendered, bar, narrow, plain)[0].tiny).toBe(false);
  });
});
