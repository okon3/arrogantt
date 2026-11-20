import { describe, expect, it } from 'vitest';
import { splitCapacity } from './allocation';
import { DEFAULT_CALENDAR } from './calendar';
import { isContended, schedule } from './simulate';
import type { Resource, Schedule, Task } from './types';

const MINUTES_PER_DAY = 8 * 60;
/** Monday 7 September 2026. */
const MONDAY = new Date(2026, 8, 7, 8, 0);
const days = (count: number) => count * MINUTES_PER_DAY;

function run(tasks: Task[], resources: Resource[] = [alice]) {
  return schedule(tasks, resources, { origin: MONDAY, calendar: DEFAULT_CALENDAR });
}

const workDone = (result: Schedule, id: string) =>
  result.tasks
    .get(id)!
    .segments.reduce(
      (sum, segment) =>
        sum + segment.rate * (segment.endWorkingMinutes - segment.startWorkingMinutes),
      0,
    );

/** [start day, end day, rate, solo rate] per segment, rounded past float drift. */
const profile = (result: Schedule, id: string) =>
  result.tasks
    .get(id)!
    .segments.map((segment) =>
      [
        segment.startWorkingMinutes / MINUTES_PER_DAY,
        segment.endWorkingMinutes / MINUTES_PER_DAY,
        segment.rate,
        segment.soloRate,
      ].map((value) => Math.round(value * 1e6) / 1e6),
    );

function expectEffortConserved(result: Schedule, tasks: Task[]) {
  for (const task of tasks) expect(workDone(result, task.id)).toBeCloseTo(task.effort, 6);
}

const alice: Resource = { id: 'alice', name: 'Alice' };
const task = (id: string, effortDays: number, extra: Partial<Task> = {}): Task => ({
  id,
  name: id,
  effort: days(effortDays),
  startConstraint: MONDAY,
  resourceId: 'alice',
  ...extra,
});

describe('a default share', () => {
  it('is exact, not a cap: alone on a full-time person it still runs at its share', () => {
    const tasks = [task('a', 5, { share: 0.2 })];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([[0, 25, 0.2, 0.2]]);
    expect(result.tasks.get('a')!.endWorkingMinutes).toBeCloseTo(days(25), 6);
    expect(isContended(result.tasks.get('a')!)).toBe(false);
    expectEffortConserved(result, tasks);
  });

  it("is a share of the person's current capacity", () => {
    const tasks = [task('a', 1, { share: 0.2 })];
    const result = run(tasks, [{ ...alice, availability: 0.5 }]);
    expect(profile(result, 'a')).toEqual([[0, 10, 0.1, 0.1]]);
    expectEffortConserved(result, tasks);
  });

  it("follows the person's capacity through a reduced period", () => {
    // Half time on Tuesday only: 0.2 of a day, 0.1 of that Tuesday, 0.2 again.
    const tasks = [task('a', 0.5, { share: 0.2 })];
    const result = run(tasks, [
      {
        ...alice,
        availabilityOverrides: [{ from: '2026-09-08', to: '2026-09-08', availability: 0.5 }],
      },
    ]);
    expect(profile(result, 'a')).toEqual([
      [0, 1, 0.2, 0.2],
      [1, 2, 0.1, 0.1],
      [2, 3, 0.2, 0.2],
    ]);
    expectEffortConserved(result, tasks);
  });
});

describe('fixed and unfixed tasks on one person', () => {
  it('leaves the unfixed task the remainder', () => {
    const tasks = [task('a', 1, { share: 0.2 }), task('b', 4)];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([[0, 5, 0.2, 0.2]]);
    expect(profile(result, 'b')).toEqual([[0, 5, 0.8, 1]]);
    expect(isContended(result.tasks.get('a')!)).toBe(false);
    expect(isContended(result.tasks.get('b')!)).toBe(true);
    expectEffortConserved(result, tasks);
  });

  it('splits the remainder equally between several unfixed tasks', () => {
    const tasks = [task('a', 1, { share: 0.2 }), task('b', 2), task('c', 2)];
    const result = run(tasks);
    expect(profile(result, 'b')).toEqual([[0, 5, 0.4, 1]]);
    expect(profile(result, 'c')).toEqual([[0, 5, 0.4, 1]]);
    expectEffortConserved(result, tasks);
  });

  it('scales shares over 100% down in proportion and stops the unfixed task', () => {
    const tasks = [task('a', 4, { share: 0.8 }), task('b', 6, { share: 0.6 }), task('c', 1)];
    const result = run(tasks);
    // A and B at 4/7 and 3/7 until A closes on day 7; B then holds its 0.6 and
    // C, which had nothing, takes the 0.4 left.
    expect(profile(result, 'a')).toEqual([[0, 7, 0.571429, 0.8]]);
    expect(profile(result, 'b')).toEqual([
      [0, 7, 0.428571, 0.6],
      [7, 12, 0.6, 0.6],
    ]);
    expect(profile(result, 'c')).toEqual([[7, 9.5, 0.4, 1]]);
    expect(isContended(result.tasks.get('a')!)).toBe(true);
    expectEffortConserved(result, tasks);
  });

  it('stops the unfixed task when the shares add up to exactly 100%', () => {
    const tasks = [task('a', 1, { share: 0.5 }), task('b', 2, { share: 0.5 }), task('c', 1)];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([[0, 2, 0.5, 0.5]]);
    expect(profile(result, 'c')).toEqual([[2, 4, 0.5, 1]]);
    expectEffortConserved(result, tasks);
  });

  it('treats shares that drift a hair under 100% as the whole', () => {
    // Shares that sum to 1 on paper can fall short of it in floating point; the
    // unfixed task must not crawl on the dust.
    const rates = splitCapacity({
      resource: alice,
      capacity: 1,
      candidates: [
        { id: 'a', remaining: 1, share: 0.5 },
        { id: 'b', remaining: 1, share: 0.5 - 1e-12 },
        { id: 'c', remaining: 1 },
      ],
    });
    expect(rates.has('c')).toBe(false);
  });
});

describe('a share period', () => {
  it('fixes the share inside it only, with boundaries on its edges', () => {
    // Tuesday to Thursday at 0.2; an ordinary equal split before and after.
    const tasks = [
      task('a', 4, { shareOverrides: [{ from: '2026-09-08', to: '2026-09-10', share: 0.2 }] }),
      task('b', 4),
    ];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([
      [0, 1, 0.5, 1],
      [1, 4, 0.2, 0.2],
      [4, 6.2, 0.5, 1],
      [6.2, 8, 1, 1],
    ]);
    expect(profile(result, 'b')).toEqual([
      [0, 1, 0.5, 1],
      [1, 4, 0.8, 1],
      [4, 6.2, 0.5, 1],
    ]);
    const a = result.tasks.get('a')!.segments;
    expect(a[1].startWorkingMinutes).toBe(days(1));
    expect(a[1].endWorkingMinutes).toBe(days(4));
    expectEffortConserved(result, tasks);
  });

  it('at zero pauses the task and hands its capacity to the other', () => {
    const tasks = [
      task('a', 4, { shareOverrides: [{ from: '2026-09-08', to: '2026-09-09', share: 0 }] }),
      task('b', 4),
    ];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([
      [0, 1, 0.5, 1],
      [3, 6, 0.5, 1],
      [6, 8, 1, 1],
    ]);
    expect(profile(result, 'b')).toEqual([
      [0, 1, 0.5, 1],
      [1, 3, 1, 1],
      [3, 6, 0.5, 1],
    ]);
    expectEffortConserved(result, tasks);
  });

  it('at zero on the only pending task jumps the clock to its end', () => {
    const tasks = [
      task('a', 4, { shareOverrides: [{ from: '2026-09-09', to: '2026-09-10', share: 0 }] }),
    ];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([
      [0, 2, 1, 1],
      [4, 6, 1, 1],
    ]);
    expectEffortConserved(result, tasks);
  });

  it('at zero holds back a task that arrives inside it', () => {
    const tasks = [
      task('a', 1, { shareOverrides: [{ from: '2026-09-07', to: '2026-09-08', share: 0 }] }),
    ];
    const result = run(tasks);
    expect(result.tasks.get('a')!.startWorkingMinutes).toBe(days(2));
    expect(result.tasks.get('a')!.endWorkingMinutes).toBe(days(3));
  });

  it('replaces the default instead of scaling it', () => {
    const tasks = [
      task('a', 1, {
        share: 0.5,
        shareOverrides: [{ from: '2026-09-07', to: '2026-09-07', share: 0.2 }],
      }),
    ];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([
      [0, 1, 0.2, 0.2],
      [1, 2.6, 0.5, 0.5],
    ]);
    expectEffortConserved(result, tasks);
  });

  const week = { from: '2026-09-07', to: '2026-09-11', share: 0.2 };
  const wednesday = { from: '2026-09-09', to: '2026-09-09', share: 1 };

  it('gives way to a narrower one declared after it', () => {
    const tasks = [task('a', 3, { shareOverrides: [week, wednesday] })];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([
      [0, 2, 0.2, 0.2],
      [2, 3, 1, 1],
      [3, 5, 0.2, 0.2],
      [5, 6.2, 1, 1],
    ]);
    expectEffortConserved(result, tasks);
  });

  it('buries a narrower one declared before it', () => {
    const tasks = [task('a', 3, { shareOverrides: [wednesday, week] })];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([
      [0, 5, 0.2, 0.2],
      [5, 7, 1, 1],
    ]);
    expectEffortConserved(result, tasks);
  });

  it('on a weekend costs nothing', () => {
    const tasks = [
      task('a', 6, { shareOverrides: [{ from: '2026-09-12', to: '2026-09-13', share: 0 }] }),
    ];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([[0, 6, 1, 1]]);
  });

  it('on a company shutdown costs nothing', () => {
    const tasks = [
      task('a', 2, { shareOverrides: [{ from: '2026-09-08', to: '2026-09-08', share: 0.2 }] }),
    ];
    const result = schedule(tasks, [alice], {
      origin: MONDAY,
      calendar: { ...DEFAULT_CALENDAR, holidays: [{ from: '2026-09-08', to: '2026-09-08' }] },
    });
    expect(profile(result, 'a')).toEqual([[0, 2, 1, 1]]);
  });
});

describe('an unassigned task with a share', () => {
  it('runs at that share of a full rate and takes nothing from the next one', () => {
    const tasks = [
      task('a', 1, { resourceId: undefined, share: 0.5 }),
      task('b', 1, { resourceId: undefined }),
    ];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([[0, 2, 0.5, 0.5]]);
    expect(profile(result, 'b')).toEqual([[0, 1, 1, 1]]);
    expect(isContended(result.tasks.get('a')!)).toBe(false);
    expectEffortConserved(result, tasks);
  });

  it('pauses on a period at zero', () => {
    const tasks = [
      task('a', 2, {
        resourceId: undefined,
        shareOverrides: [{ from: '2026-09-08', to: '2026-09-08', share: 0 }],
      }),
    ];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([
      [0, 1, 1, 1],
      [2, 3, 1, 1],
    ]);
  });
});

describe('a share that never lets the task finish', () => {
  it('is refused by name when the default is zero', () => {
    expect(() => run([task('a', 1, { share: 0 })])).toThrow(
      'Scheduler stalled: task "a" is left at a share of zero and can never finish',
    );
  });

  it('is refused when its positive periods are too short for the effort', () => {
    const periods = [{ from: '2026-09-08', to: '2026-09-08', share: 1 }];
    expect(() => run([task('a', 2, { share: 0, shareOverrides: periods })])).toThrow(
      /share of zero/,
    );
    expect(run([task('a', 1, { share: 0, shareOverrides: periods })]).tasks.get('a')!)
      .toMatchObject({ startWorkingMinutes: days(1), endWorkingMinutes: days(2) });
  });

  it('is refused for an unassigned task too, and with other work still running', () => {
    expect(() =>
      run([task('a', 1, { resourceId: undefined, share: 0 }), task('b', 3)]),
    ).toThrow(/task "a" is left at a share of zero/);
  });

  it('does not trip the convergence bound on a long run of periods', () => {
    // One period a day for a year, alternating: every edge is an event.
    const shareOverrides = Array.from({ length: 365 }, (_, index) => {
      const day = new Date(Date.UTC(2026, 8, 7 + index)).toISOString().slice(0, 10);
      return { from: day, to: day, share: index % 2 === 0 ? 0 : 0.5 };
    });
    const tasks = [task('a', 60, { shareOverrides })];
    const result = run(tasks);
    expectEffortConserved(result, tasks);
  });
});
