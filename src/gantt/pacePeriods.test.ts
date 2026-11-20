import { describe, expect, it } from 'vitest';
import { dayIndexOfString, type ShareOverride } from '../scheduler';
import {
  MIN_INTERACTIVE_PX,
  addPeriod,
  clipToSpan,
  dragSpan,
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
const period = (from: string, to: string, share = 0.5, label?: string): ShareOverride => ({
  from: `2026-09-${from}`,
  to: `2026-09-${to}`,
  share,
  ...(label ? { label } : {}),
});
/** Monday 7 to Friday 18 September. */
const span = { from: day('07'), to: day('18') };

describe('nearestMidnight', () => {
  it('snaps to the midnight the instant is closest to, not the one before it', () => {
    expect(nearestMidnight(new Date(2026, 8, 9, 0, 0))).toBe(day('09'));
    expect(nearestMidnight(new Date(2026, 8, 9, 11, 59))).toBe(day('09'));
    expect(nearestMidnight(new Date(2026, 8, 9, 12, 0))).toBe(day('10'));
    expect(nearestMidnight(new Date(2026, 8, 9, 23, 59))).toBe(day('10'));
  });
});

describe('clipToSpan', () => {
  it('keeps a period inside, trims one partly outside, drops one wholly outside', () => {
    const inside = period('08', '09', 0.5, 'Audit');
    expect(
      clipToSpan(
        [period('01', '08'), inside, period('17', '25', 0), period('01', '06'), period('19', '20')],
        span.from,
        span.to,
      ),
    ).toEqual([period('07', '08'), inside, period('17', '18', 0)]);
  });

  it('keeps a period on the span’s first or last day alone', () => {
    const edges = [period('07', '07'), period('18', '18')];
    expect(clipToSpan(edges, span.from, span.to)).toEqual(edges);
  });
});

describe('moveEdge', () => {
  const periods = [period('09', '10', 0.5, 'Audit'), period('14', '15', 0)];

  it('moves the edge to whole days, the other edge and the rest left alone', () => {
    expect(moveEdge(periods, 0, 'to', day('12'), span)).toEqual([
      period('09', '11', 0.5, 'Audit'),
      periods[1],
    ]);
    expect(moveEdge(periods, 0, 'from', day('08'), span)[0]).toEqual(period('08', '10', 0.5, 'Audit'));
    // The boundary a `to` edge is dropped on is the midnight after its last day.
    expect(moveEdge(periods, 0, 'to', day('10'), span)[0]).toEqual(period('09', '09', 0.5, 'Audit'));
  });

  it('stops at the task’s span on either side', () => {
    expect(moveEdge(periods, 0, 'from', day('01'), span)[0].from).toBe('2026-09-07');
    expect(moveEdge(periods, 1, 'to', day('30'), span)[1].to).toBe('2026-09-18');
  });

  it('stops at the day beside the neighbouring period, whatever the list order', () => {
    expect(moveEdge(periods, 0, 'to', day('18'), span)[0].to).toBe('2026-09-13');
    expect(moveEdge(periods, 1, 'from', day('08'), span)[1].from).toBe('2026-09-11');
    const reversed = [periods[1], periods[0]];
    expect(moveEdge(reversed, 1, 'to', day('18'), span)[1].to).toBe('2026-09-13');
  });

  it('never hands the gate an overlap', () => {
    for (let boundary = day('01'); boundary <= day('30'); boundary++) {
      for (const [index, edge] of [[0, 'from'], [0, 'to'], [1, 'from'], [1, 'to']] as const) {
        expect(() => parseTaskShare(undefined, moveEdge(periods, index, edge, boundary, span))).not.toThrow();
      }
    }
  });

  it('removes its own period, and only that, once an edge passes the other', () => {
    expect(moveEdge(periods, 0, 'from', day('11'), span)).toEqual([periods[1]]);
    expect(moveEdge(periods, 0, 'to', day('09'), span)).toEqual([periods[1]]);
    // Far past the neighbour too: the neighbour is not the one being dragged.
    expect(moveEdge(periods, 0, 'from', day('20'), span)).toEqual([periods[1]]);
    expect(moveEdge(periods, 1, 'to', day('08'), span)).toEqual([periods[0]]);
  });

  it('leaves the caller’s list as it was', () => {
    const before = JSON.stringify(periods);
    moveEdge(periods, 0, 'to', day('18'), span);
    expect(JSON.stringify(periods)).toBe(before);
  });
});

describe('dragSpan', () => {
  const atPress = { from: day('07'), to: day('11') };

  it('follows a bar the drag makes longer, on its end', () => {
    expect(dragSpan(atPress, { from: day('07'), to: day('16') }, period('10', '11', 0)).to).toBe(
      day('16'),
    );
  });

  it('keeps the start the drag began with when a pause pushes the solved start away', () => {
    const live = { from: day('10'), to: day('15') };
    expect(dragSpan(atPress, live, period('08', '09', 0)).from).toBe(day('07'));
  });

  it('never ends short of where the period already stands', () => {
    // A pause that became the task's first days: the bar now starts after it.
    const leading = period('07', '07', 0);
    const pushed = { from: day('08'), to: day('14') };
    expect(dragSpan(pushed, pushed, leading)).toEqual({ from: day('07'), to: day('14') });
    expect(moveEdge([leading], 0, 'to', day('09'), dragSpan(pushed, pushed, leading))).toEqual([
      period('07', '08', 0),
    ]);
    expect(dragSpan(atPress, atPress, period('10', '14')).to).toBe(day('14'));
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
    const periods = [period('09', '10'), period('14', '15', 0)];
    expect(setLevel(periods, 1, 0.3)).toEqual([periods[0], period('14', '15', 0.3)]);
    expect(shareLabel(0)).toBe('paused');
    expect(shareLabel(1 / 3)).toBe('33%');
  });
});

describe('addPeriod', () => {
  const periods = [period('09', '10')];

  it('appends one day at the share it is given', () => {
    expect(addPeriod(periods, day('14'), 1 / 3, span)).toEqual([
      periods[0],
      period('14', '14', 1 / 3),
    ]);
    expect(addPeriod([], span.from, 1, span)).toEqual([period('07', '07', 1)]);
    expect(addPeriod([], span.to, 1, span)).toEqual([period('18', '18', 1)]);
  });

  it('adds nothing outside the task or inside a period, and says so by identity', () => {
    expect(addPeriod(periods, day('06'), 1, span)).toBe(periods);
    expect(addPeriod(periods, day('19'), 1, span)).toBe(periods);
    expect(addPeriod(periods, day('09'), 1, span)).toBe(periods);
    expect(addPeriod(periods, day('10'), 1, span)).toBe(periods);
  });

  it('takes the day beside a period', () => {
    expect(addPeriod(periods, day('11'), 1, span)).toHaveLength(2);
  });
});

describe('the list helpers', () => {
  const periods = [period('09', '10', 0.5, 'Audit'), period('14', '15', 0)];

  it('removes one period by position', () => {
    expect(removePeriod(periods, 0)).toEqual([periods[1]]);
  });

  it('compares by content, label included', () => {
    expect(samePeriods(periods, periods.map((entry) => ({ ...entry })))).toBe(true);
    expect(samePeriods(periods, [periods[0]])).toBe(false);
    expect(samePeriods(periods, setLevel(periods, 1, 0.1))).toBe(false);
    expect(samePeriods(periods, [period('09', '10', 0.5), periods[1]])).toBe(false);
  });
});

describe('periodBoxes', () => {
  const rendered = { firstDay: day('07'), endDay: day('21') };
  const bar = { top: 72, height: 24, rowHeight: 36 };
  const dayX = (index: number) => (index - rendered.firstDay) * 40;

  it('spans its days from midnight to midnight, centred in the row like the bar', () => {
    expect(periodBoxes([period('09', '10', 0.25)], rendered, bar, dayX)).toEqual([
      { index: 0, left: 80, top: 78, width: 80, height: 24, share: 0.25, tiny: false },
    ]);
  });

  it('clips to the rendered range and skips a period outside it, keeping positions', () => {
    const boxes = periodBoxes(
      [period('01', '08'), period('01', '05'), period('19', '25')],
      rendered,
      bar,
      dayX,
    );
    expect(boxes.map(({ index, left, width }) => ({ index, left, width }))).toEqual([
      { index: 0, left: 0, width: 80 },
      { index: 2, left: 480, width: 80 },
    ]);
  });

  it('calls a period too narrow to aim at tiny', () => {
    const narrow = (index: number) => (index - rendered.firstDay) * (MIN_INTERACTIVE_PX - 1);
    expect(periodBoxes([period('09', '09')], rendered, bar, narrow)[0].tiny).toBe(true);
    expect(periodBoxes([period('09', '10')], rendered, bar, narrow)[0].tiny).toBe(false);
  });
});
