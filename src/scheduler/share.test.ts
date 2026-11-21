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

  it('leaves two fixed shares under 100% as they are, the rest free', () => {
    const tasks = [task('a', 1, { share: 0.2 }), task('b', 3, { share: 0.3 })];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([[0, 5, 0.2, 0.2]]);
    expect(profile(result, 'b')).toEqual([[0, 10, 0.3, 0.3]]);
    expectEffortConserved(result, tasks);
  });

  it('takes both the share and the remainder from a part-time capacity', () => {
    const tasks = [task('a', 1, { share: 0.2 }), task('b', 4)];
    const result = run(tasks, [{ ...alice, availability: 0.5 }]);
    expect(profile(result, 'a')).toEqual([[0, 10, 0.1, 0.1]]);
    expect(profile(result, 'b')).toEqual([[0, 10, 0.4, 0.5]]);
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

describe('an event a hair off a whole minute', () => {
  const wholeMinutes = (result: Schedule) => {
    for (const scheduled of result.tasks.values()) {
      for (const segment of scheduled.segments) {
        expect(Number.isInteger(segment.startWorkingMinutes)).toBe(true);
        expect(Number.isInteger(segment.endWorkingMinutes)).toBe(true);
      }
      expect(Number.isInteger(scheduled.startWorkingMinutes)).toBe(true);
      expect(Number.isInteger(scheduled.endWorkingMinutes)).toBe(true);
    }
  };

  it('ends on the evening it reaches, not the next morning', () => {
    // 1 - 0.8 is not 0.2: B's day of work divides into a hair over five days.
    const tasks = [task('a', 5, { share: 0.8 }), task('b', 1)];
    const result = run(tasks);
    expect(result.tasks.get('b')!.end).toEqual(new Date(2026, 8, 11, 17, 0));
    wholeMinutes(result);
    expectEffortConserved(result, tasks);
  });

  it('starts and ends on the minute when shares over 100% are scaled down', () => {
    const start = new Date(2026, 10, 23, 8, 0);
    const tasks = [
      task('a', 6, { share: 0.8, startConstraint: start }),
      task('b', 6, { share: 0.6, startConstraint: start }),
      task('c', 1, { startConstraint: start }),
    ];
    const result = schedule(tasks, [alice], { origin: start, calendar: DEFAULT_CALENDAR });
    expect(result.tasks.get('a')!.end).toEqual(new Date(2026, 11, 7, 12, 0));
    // The same working minute seen from its other side: after the lunch break.
    expect(result.tasks.get('c')!.segments[0].start).toEqual(new Date(2026, 11, 7, 13, 0));
    expect(result.tasks.get('b')!.end).toEqual(new Date(2026, 11, 9, 17, 0));
    expect(result.tasks.get('c')!.end).toEqual(new Date(2026, 11, 9, 17, 0));
    wholeMinutes(result);
    expectEffortConserved(result, tasks);
  });
});

const period = (fromDay: number, toDay: number, share: number) => ({ fromDay, toDay, share });

describe('a share period', () => {
  it('fixes the share inside it only, with boundaries on its edges', () => {
    // The task's second to fourth day at 0.2; an ordinary equal split around it.
    const tasks = [task('a', 4, { shareOverrides: [period(1, 3, 0.2)] }), task('b', 4)];
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
    const tasks = [task('a', 4, { shareOverrides: [period(1, 2, 0)] }), task('b', 4)];
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
    const tasks = [task('a', 4, { shareOverrides: [period(2, 3, 0)] })];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([
      [0, 2, 1, 1],
      [4, 6, 1, 1],
    ]);
    expectEffortConserved(result, tasks);
  });

  it('replaces the default instead of scaling it', () => {
    const tasks = [task('a', 1, { share: 0.5, shareOverrides: [period(0, 0, 0.2)] })];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([
      [0, 1, 0.2, 0.2],
      [1, 2.6, 0.5, 0.5],
    ]);
    expectEffortConserved(result, tasks);
  });

  const week = period(0, 4, 0.2);
  const third = period(2, 2, 1);

  it('gives way to a narrower one declared after it', () => {
    const tasks = [task('a', 3, { shareOverrides: [week, third] })];
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
    const tasks = [task('a', 3, { shareOverrides: [third, week] })];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([
      [0, 5, 0.2, 0.2],
      [5, 7, 1, 1],
    ]);
    expectEffortConserved(result, tasks);
  });
});

describe('a share period is counted in the working days of its task', () => {
  const sixDays = (extra: Partial<Task> = {}) => [
    task('a', 6, { shareOverrides: [period(2, 4, 0.2)], ...extra }),
    task('b', 6),
  ];

  it("holds on the task's third to fifth day", () => {
    const tasks = sixDays();
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([
      [0, 2, 0.5, 1],
      [2, 5, 0.2, 0.2],
      [5, 10.2, 0.5, 1],
      [10.2, 12, 1, 1],
    ]);
    expect(profile(result, 'b')).toEqual([
      [0, 2, 0.5, 1],
      [2, 5, 0.8, 1],
      [5, 10.2, 0.5, 1],
    ]);
    expectEffortConserved(result, tasks);
  });

  it('moves with a start constraint a week later', () => {
    const tasks = sixDays({ startConstraint: new Date(2026, 8, 14, 8, 0) });
    const result = run(tasks);
    // B has the first week to itself; A's third to fifth day are now 16–18.
    expect(profile(result, 'a')).toEqual([
      [5, 7, 0.5, 1],
      [7, 10, 0.2, 0.2],
      [10, 14.4, 1, 1],
    ]);
    const paced = result.tasks.get('a')!.segments[1];
    expect(paced.start).toEqual(new Date(2026, 8, 16, 8, 0));
    expect(paced.end).toEqual(new Date(2026, 8, 18, 17, 0));
    expectEffortConserved(result, tasks);
  });

  it('counts the half day a predecessor leaves as day 0', () => {
    // P ends at noon, so A is anchored at 13:00 on Monday.
    const tasks = [
      task('p', 0.5, { resourceId: undefined }),
      task('a', 1, {
        predecessors: ['p'],
        shareOverrides: [period(0, 0, 0.5), period(1, 1, 0.25)],
      }),
    ];
    const result = run(tasks);
    const a = result.tasks.get('a')!;
    expect(a.start).toEqual(new Date(2026, 8, 7, 13, 0));
    expect(profile(result, 'a')).toEqual([
      [0.5, 1, 0.5, 0.5],
      [1, 2, 0.25, 0.25],
      [2, 2.5, 1, 1],
    ]);
    expect(a.segments[0].end).toEqual(new Date(2026, 8, 7, 17, 0));
    expect(a.segments[1].start).toEqual(new Date(2026, 8, 8, 8, 0));
    expect(a.segments[1].end).toEqual(new Date(2026, 8, 8, 17, 0));
    expect(a.end).toEqual(new Date(2026, 8, 9, 12, 0));
    expectEffortConserved(result, tasks);
  });

  it('does not count a weekend', () => {
    // Days 4 and 5 are the Friday and the Monday after it.
    const tasks = [task('a', 8, { shareOverrides: [period(4, 5, 0.5)] })];
    const result = run(tasks);
    expect(profile(result, 'a')).toEqual([
      [0, 4, 1, 1],
      [4, 6, 0.5, 0.5],
      [6, 9, 1, 1],
    ]);
    const paced = result.tasks.get('a')!.segments[1];
    expect(paced.start).toEqual(new Date(2026, 8, 11, 8, 0));
    expect(paced.end).toEqual(new Date(2026, 8, 14, 17, 0));
    expectEffortConserved(result, tasks);
  });

  it('does not count a company shutdown', () => {
    const tasks = [task('a', 2, { shareOverrides: [period(1, 1, 0.5)] })];
    const result = schedule(tasks, [alice], {
      origin: MONDAY,
      calendar: { ...DEFAULT_CALENDAR, holidays: [{ from: '2026-09-08', to: '2026-09-08' }] },
    });
    // Tuesday is closed: day 1 is the Wednesday.
    expect(profile(result, 'a')).toEqual([
      [0, 1, 1, 1],
      [1, 2, 0.5, 0.5],
      [2, 2.5, 1, 1],
    ]);
    expect(result.tasks.get('a')!.segments[1].start).toEqual(new Date(2026, 8, 9, 8, 0));
  });

  it('is anchored on the day its person is back', () => {
    const tasks = [task('a', 3, { shareOverrides: [period(1, 1, 0.5)] })];
    const result = run(tasks, [
      {
        ...alice,
        availabilityOverrides: [{ from: '2026-09-07', to: '2026-09-07', availability: 0 }],
      },
    ]);
    const a = result.tasks.get('a')!;
    expect(a.start).toEqual(new Date(2026, 8, 8, 8, 0));
    expect(a.startWorkingMinutes).toBe(days(1));
    expect(profile(result, 'a')).toEqual([
      [1, 2, 1, 1],
      [2, 3, 0.5, 0.5],
      [3, 4.5, 1, 1],
    ]);
    expectEffortConserved(result, tasks);
  });

  it('cuts at its own edges when an absence lies further on', () => {
    // The absence is on the event list first, and later than the period.
    const tasks = [task('a', 2, { shareOverrides: [period(1, 1, 0.5)] })];
    const result = run(tasks, [
      {
        ...alice,
        availabilityOverrides: [{ from: '2026-09-21', to: '2026-09-21', availability: 0 }],
      },
    ]);
    expect(profile(result, 'a')).toEqual([
      [0, 1, 1, 1],
      [1, 2, 0.5, 0.5],
      [2, 2.5, 1, 1],
    ]);
    expectEffortConserved(result, tasks);
  });
});

describe('a task that waits inside its own span', () => {
  it('starts on its anchor when its first days are paused', () => {
    const tasks = [task('a', 2, { shareOverrides: [period(0, 1, 0)] }), task('b', 2)];
    const result = run(tasks);
    const a = result.tasks.get('a')!;
    expect(a.start).toEqual(MONDAY);
    expect(a.startWorkingMinutes).toBe(0);
    expect(a.elapsedWorkingMinutes).toBe(days(4));
    expect(profile(result, 'a')).toEqual([[2, 4, 1, 1]]);
    expect(profile(result, 'b')).toEqual([[0, 2, 1, 1]]);
    expectEffortConserved(result, tasks);
  });

  it('starts on its anchor when fixed shares leave it nothing', () => {
    const tasks = [
      task('x', 1.2, { share: 0.6 }),
      task('y', 0.8, { share: 0.4 }),
      task('c', 1),
    ];
    const result = run(tasks);
    const c = result.tasks.get('c')!;
    expect(c.start).toEqual(MONDAY);
    expect(c.startWorkingMinutes).toBe(0);
    expect(profile(result, 'c')).toEqual([[2, 3, 1, 1]]);
    expectEffortConserved(result, tasks);
  });
});

describe('a plan without shares', () => {
  const bob: Resource = { id: 'bob', name: 'Bob', availability: 0.5 };
  const away: Resource = {
    id: 'carla',
    name: 'Carla',
    availabilityOverrides: [
      { from: '2026-09-07', to: '2026-09-08', availability: 0 },
      { from: '2026-09-10', to: '2026-09-10', availability: 0 },
    ],
  };
  const tasks = [
    task('free', 2, { resourceId: undefined }),
    task('one', 2),
    task('two', 3, { startConstraint: new Date(2026, 8, 8, 8, 0) }),
    task('after', 1, { predecessors: ['one'], startConstraint: undefined }),
    task('half', 1.25, { resourceId: 'bob' }),
    task('late', 1, { resourceId: 'bob', predecessors: ['half'] }),
    task('back', 2, { resourceId: 'carla' }),
    task('held', 1, { resourceId: 'carla', predecessors: ['free'] }),
  ];
  const result = run(tasks, [alice, bob, away]);

  it('starts every task on the first minute it works', () => {
    for (const { id } of tasks) {
      const scheduled = result.tasks.get(id)!;
      expect(scheduled.startWorkingMinutes, id).toBe(scheduled.segments[0].startWorkingMinutes);
      expect(scheduled.start, id).toEqual(scheduled.segments[0].start);
    }
    expectEffortConserved(result, tasks);
  });

  it('works from its start on a day with next to no capacity', () => {
    const thin = [task('a', 1)];
    const a = run(thin, [
      {
        ...alice,
        availabilityOverrides: [{ from: '2026-09-07', to: '2026-09-07', availability: 1e-10 }],
      },
    ]).tasks.get('a')!;
    expect(a.startWorkingMinutes).toBe(0);
    expect(a.segments[0].startWorkingMinutes).toBe(0);
  });

  it('puts those starts where the plan always had them', () => {
    const startDay = (id: string) => result.tasks.get(id)!.startWorkingMinutes / MINUTES_PER_DAY;
    expect(Object.fromEntries(tasks.map(({ id }) => [id, startDay(id)]))).toEqual({
      free: 0,
      one: 0,
      two: 1,
      after: 3,
      half: 0,
      late: 2.5,
      back: 2,
      held: 2,
    });
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
    const tasks = [task('a', 2, { resourceId: undefined, shareOverrides: [period(1, 1, 0)] })];
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
    const periods = [period(1, 1, 1)];
    expect(() => run([task('a', 2, { share: 0, shareOverrides: periods })])).toThrow(
      /share of zero/,
    );
    const a = run([task('a', 1, { share: 0, shareOverrides: periods })]).tasks.get('a')!;
    expect(a).toMatchObject({ startWorkingMinutes: 0, endWorkingMinutes: days(2) });
    expect(a.segments[0].startWorkingMinutes).toBe(days(1));
  });

  it('is refused for an unassigned task too, and with other work still running', () => {
    expect(() =>
      run([task('a', 1, { resourceId: undefined, share: 0 }), task('b', 3)]),
    ).toThrow(/task "a" is left at a share of zero/);
  });

  it('does not trip the convergence bound on a long run of periods', () => {
    // One period a day for a year, alternating: every edge is an event.
    const shareOverrides = Array.from({ length: 365 }, (_, index) =>
      period(index, index, index % 2 === 0 ? 0 : 0.5),
    );
    const tasks = [task('a', 60, { shareOverrides })];
    const result = run(tasks);
    expectEffortConserved(result, tasks);
  });
});

