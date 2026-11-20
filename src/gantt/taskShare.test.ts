import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR, dayIndexOf, type ScheduledTask } from '../scheduler';
import { setLevel } from './pacePeriods';
import { barFactsOf, renderBarTooltip } from './barTooltip';
import { buildPlan } from './plan';
import {
  constraintStart,
  solve,
  trimSharePeriods,
  type Project,
  type ProjectTask,
} from './project';
import { drawsProfile, renderSegments } from './segmentBar';
import {
  ProjectFileError,
  deserializeProject,
  serializeForFile,
  serializeProject,
} from './serialization';
import {
  MAX_PERIOD_DAY,
  datePeriods,
  hasShare,
  parseTaskShare,
  seedShare,
  seededSharePeriod,
  shareOnDay,
  taskDays,
  trimToTask,
  undatePeriods,
} from './taskShare';

const at = (dayOffset: number) => new Date(2026, 8, 7 + dayOffset, 8, 0);
/** The task's third and fourth working day: 9 and 10 September on a task starting on the 7th. */
const period = { fromDay: 2, toDay: 3, share: 0 };

function project(tasks: ProjectTask[]): Project {
  return { calendar: DEFAULT_CALENDAR, resources: [{ id: 'alice', name: 'Alice' }], tasks };
}

const leaf = (patch: Partial<ProjectTask> = {}): ProjectTask => ({
  id: '1',
  name: 'Build',
  nominalDays: 4,
  start: at(0),
  resourceId: 'alice',
  ...patch,
});

describe('parseTaskShare, the one gate', () => {
  it('refuses a share below 1% that is not a pause, default and period alike', () => {
    expect(() => parseTaskShare(1e-12, undefined)).toThrow(/below 1%/);
    expect(() => parseTaskShare(undefined, [{ ...period, share: 0.009 }])).toThrow(
      /Share period 1: a share below 1%/,
    );
    const later = { fromDay: 4, toDay: 4, share: 0 };
    expect(parseTaskShare(0.01, [{ ...period, share: 0.01 }, later])).toEqual({
      share: 0.01,
      shareOverrides: [{ ...period, share: 0.01 }, later],
    });
  });

  it('answers the normal form: nothing fixed, nothing written', () => {
    expect(parseTaskShare(undefined, undefined)).toEqual({});
    expect(parseTaskShare(undefined, [])).toEqual({});
    expect(parseTaskShare(0.2, [{ ...period, label: '' }])).toEqual({
      share: 0.2,
      shareOverrides: [period],
    });
  });

  it('keeps a label and the declared order, and takes 0 and 1 in a period', () => {
    const periods = [
      { fromDay: 3, toDay: 3, share: 1, label: 'Crunch' },
      { fromDay: 2, toDay: 2, share: 0 },
    ];
    expect(parseTaskShare(1, periods)).toEqual({ share: 1, shareOverrides: periods });
  });

  it('refuses two periods sharing a day, naming both as declared', () => {
    const week = { fromDay: 0, toDay: 4, share: 0.5 };
    const wednesday = { fromDay: 2, toDay: 2, share: 0 };
    const apart = { fromDay: 7, toDay: 7, share: 0 };
    expect(() => parseTaskShare(undefined, [apart, wednesday, week])).toThrow(
      'Share periods 2 and 3 overlap (day 2 and days 0 to 4)',
    );
    expect(() => parseTaskShare(undefined, [week, { ...week, share: 0 }])).toThrow(/1 and 2 overlap/);
    // One day in common is an overlap; none, however close, is not.
    expect(() => parseTaskShare(undefined, [week, { ...apart, fromDay: 4 }])).toThrow(/overlap/);
    const adjacent = [week, { fromDay: 5, toDay: 7, share: 0 }];
    expect(parseTaskShare(undefined, adjacent).shareOverrides).toEqual(adjacent);
  });

  it('refuses a default of zero, pointing at a period instead', () => {
    expect(() => parseTaskShare(0, undefined)).toThrow(/period at 0/);
  });

  it.each([-0.1, 1.01, NaN, Infinity, '0.5', null])('refuses a default of %s', (share) => {
    expect(() => parseTaskShare(share, undefined)).toThrow(/Invalid share/);
  });

  it.each([-0.1, 1.01, NaN, Infinity, '0.5', undefined, null])(
    'refuses a period share of %s',
    (share) => {
      expect(() => parseTaskShare(undefined, [{ ...period, share }])).toThrow(/Share period 1/);
    },
  );

  it.each([
    [{ toDay: 3, share: 0 }, /whole "fromDay" and "toDay"/],
    [{ fromDay: 2, toDay: '3', share: 0 }, /whole "fromDay" and "toDay"/],
    [{ fromDay: 2.5, toDay: 3, share: 0 }, /whole "fromDay" and "toDay"/],
    [{ fromDay: -1, toDay: 3, share: 0 }, /whole "fromDay" and "toDay"/],
    [{ fromDay: 5, toDay: MAX_PERIOD_DAY + 1, share: 0 }, /whole "fromDay" and "toDay"/],
    [{ fromDay: 5, toDay: 4, share: 0 }, /ends before it starts/],
    // The dated shape this feature was first drafted in: refused, never repaired.
    [{ from: '2026-09-11', to: '2026-09-11', share: 0 }, /day offsets from the task's start/],
    [{ fromDay: 5, toDay: 5, to: '2026-09-11', share: 0 }, /day offsets from the task's start/],
    ['2026-09-09', /expected \{ fromDay, toDay, share \}/],
  ])('refuses the period %j', (entry, message) => {
    expect(() => parseTaskShare(undefined, [period, entry])).toThrow(message);
    expect(() => parseTaskShare(undefined, [period, entry])).toThrow(/Share period 2/);
  });

  it('refuses a period list that is not a list', () => {
    expect(() => parseTaskShare(undefined, { fromDay: 0 })).toThrow(/expected a list/);
  });
});

describe('shareOnDay', () => {
  const task = {
    share: 0.5,
    shareOverrides: [
      { fromDay: 1, toDay: 2, share: 0 },
      { fromDay: 3, toDay: 3, share: 0.25 },
    ],
  };

  it('lets a period replace the default on its own days', () => {
    expect(shareOnDay(task, 0)).toBe(0.5);
    expect(shareOnDay(task, 1)).toBe(0);
    expect(shareOnDay(task, 3)).toBe(0.25);
    expect(shareOnDay({ shareOverrides: task.shareOverrides }, 0)).toBeUndefined();
  });
});

describe('share in the file', () => {
  it('round-trips a default and its periods through the file gate', () => {
    const tasks = [leaf({ share: 0.2, shareOverrides: [{ ...period, label: 'Audit' }] })];
    const text = serializeForFile(project(tasks), solve(project(tasks)));
    expect(JSON.parse(text).version).toBe(2);
    expect(deserializeProject(text).tasks).toEqual(tasks);
  });

  it('leaves a file without the fields exactly as it was', () => {
    const text = serializeProject(project([leaf()]));
    expect(text).not.toContain('share');
    expect(serializeProject(deserializeProject(text))).toBe(text);
  });

  it('reads an empty period list as none, so one state has one spelling', () => {
    const file = JSON.parse(serializeProject(project([leaf()])));
    file.tasks[0].shareOverrides = [];
    const restored = deserializeProject(JSON.stringify(file));
    expect('shareOverrides' in restored.tasks[0]).toBe(false);
  });

  it('writes neither field on a summary, which never runs', () => {
    const tasks = [
      leaf({ id: 'group', share: 0.5, shareOverrides: [period] }),
      leaf({ id: 'child', parentId: 'group', share: 0.5 }),
    ];
    const written = JSON.parse(serializeProject(project(tasks))).tasks;
    expect('share' in written[0]).toBe(false);
    expect('shareOverrides' in written[0]).toBe(false);
    expect(written[1].share).toBe(0.5);
  });

  it.each([
    [{ share: 0 }, /period at 0/],
    [{ share: 1.5 }, /Invalid share/],
    [{ share: '0.5' }, /Invalid share/],
    [{ shareOverrides: [{ fromDay: 2, share: 0 }] }, /whole "fromDay" and "toDay"/],
    [{ shareOverrides: [{ ...period, fromDay: 4 }] }, /ends before it starts/],
    [{ shareOverrides: [{ ...period, share: 2 }] }, /numeric "share"/],
    [{ shareOverrides: [{ fromDay: 2, toDay: 3 }] }, /numeric "share"/],
    [{ shareOverrides: [period, { ...period, fromDay: period.toDay }] }, /periods 1 and 2 overlap/],
    [
      { shareOverrides: [{ from: '2026-09-09', to: '2026-09-10', share: 0 }] },
      /day offsets from the task's start/,
    ],
  ])('refuses a task carrying %j, naming it', (fields, message) => {
    const file = JSON.parse(serializeProject(project([leaf()])));
    Object.assign(file.tasks[0], fields);
    const load = () => deserializeProject(JSON.stringify(file));
    expect(load).toThrow(ProjectFileError);
    expect(load).toThrow(message);
    expect(load).toThrow(/tasks\[0\]/);
  });

  it('refuses to save a share the model should never have held', () => {
    const tasks = [leaf({ share: Infinity })];
    expect(() => serializeForFile(project(tasks))).toThrow(ProjectFileError);
  });
});

describe('share on its way to the engine and to a script', () => {
  const tasks = [
    leaf({ id: 'group', share: 0.9 }),
    leaf({ id: 'paced', parentId: 'group', share: 0.2, shareOverrides: [period] }),
    leaf({ id: 'free', parentId: 'group' }),
    leaf({ id: 'gate', nominalDays: 0, resourceId: undefined, shareOverrides: [period] }),
  ];
  const solved = solve(project(tasks));
  const engine = new Map(solved.engineTasks.map((task) => [task.id, task]));

  it('hands a leaf its share as the fraction the model holds', () => {
    expect(engine.get('paced')).toMatchObject({ share: 0.2, shareOverrides: [period] });
  });

  it('hands nothing for an unfixed leaf, a summary or a milestone', () => {
    expect(engine.has('group')).toBe(false);
    for (const id of ['free', 'gate']) {
      expect('share' in engine.get(id)!).toBe(false);
      expect('shareOverrides' in engine.get(id)!).toBe(false);
    }
  });

  it('reports it in the plan on the leaf only, as a copy', () => {
    const plan = new Map(buildPlan(solved).tasks.map((task) => [task.id, task]));
    expect(plan.get('paced')).toMatchObject({ share: 0.2, shareOverrides: [period] });
    expect(plan.get('paced')!.shareOverrides![0]).not.toBe(tasks[1].shareOverrides![0]);
    expect('share' in plan.get('group')!).toBe(false);
    expect('share' in plan.get('free')!).toBe(false);
  });
});

describe('the bar rule', () => {
  const segment = (fromDay: number, toDay: number, rate = 1, soloRate = 1) => ({
    start: at(fromDay),
    end: at(toDay),
    startWorkingMinutes: fromDay * 480,
    endWorkingMinutes: toDay * 480,
    rate,
    soloRate,
  });
  const scheduled = (segments: ReturnType<typeof segment>[]): ScheduledTask => ({
    id: '1',
    start: segments[0].start,
    end: segments[segments.length - 1].end,
    startWorkingMinutes: segments[0].startWorkingMinutes,
    endWorkingMinutes: segments[segments.length - 1].endWorkingMinutes,
    elapsedWorkingMinutes: 0,
    effortMinutes: 0,
    segments,
  });
  const stopped = scheduled([segment(0, 2), segment(4, 6)]);

  it('draws the profile on a paced task stopped inside its span', () => {
    expect(drawsProfile(stopped, true)).toBe(true);
  });

  it('draws it for a stop the schedule carries as a segment at zero, too', () => {
    expect(drawsProfile(scheduled([segment(0, 2), segment(2, 4, 0, 0), segment(4, 6)]), true)).toBe(
      true,
    );
  });

  it('keeps a full-rate bar with the same gap plain when the task fixes nothing', () => {
    expect(drawsProfile(stopped, false)).toBe(false);
  });

  it('keeps a paced task running back to back at full rate plain', () => {
    expect(drawsProfile(scheduled([segment(0, 2), segment(2, 4)]), true)).toBe(false);
  });

  it('draws a wait before the first segment as empty track, whoever caused it', () => {
    // Anchored on day 0, working from day 2: the span opens two days early.
    const waiting = { ...scheduled([segment(2, 4)]), start: at(0), startWorkingMinutes: 0 };
    expect(drawsProfile(waiting, false)).toBe(true);
    // Along the floor to the middle of the bar, then up: no ramp from the corner.
    expect(renderSegments(waiting, 200, '#000', '#000')).toContain('d="M 0,100 L 50.00,100 L 50.00,0.00');
  });

  it('leaves the bar across a person\'s absence the plain fill it was', () => {
    const away: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [
        {
          id: 'alice',
          name: 'Alice',
          availabilityOverrides: [{ from: '2026-09-09', to: '2026-09-10', availability: 0 }],
        },
      ],
      tasks: [leaf()],
    };
    const bar = solve(away).schedule.tasks.get('1')!;
    // The absence did stretch it: four days of work, six on the calendar.
    expect(bar.elapsedWorkingMinutes).toBe(6 * 480);
    // The verdict as both row writers reach it (`ganttRows`, `applySolution`).
    expect(drawsProfile(bar, hasShare(away.tasks[0]))).toBe(false);
  });
});

describe('the tooltip facts', () => {
  const facts = (task: ProjectTask) => {
    const solved = solve(project([task]));
    return barFactsOf(task, solved.schedule.tasks.get(task.id)!, solved, [], null, 0);
  };

  it('carries the pace of a leaf that fixes one', () => {
    expect(facts(leaf({ share: 0.2 })).pace).toEqual({ share: 0.2 });
    expect('pace' in facts(leaf())).toBe(false);
  });

  it('carries none on a milestone, where it is inert', () => {
    expect('pace' in facts(leaf({ nominalDays: 0, share: 0.2 }))).toBe(false);
  });
});

describe('against the schedule the engine returns', () => {
  const alice = [{ id: 'alice', name: 'Alice' }];
  const read = (tasks: ProjectTask[], id = '1') => {
    const solved = solve(project(tasks));
    const task = tasks.find((candidate) => candidate.id === id)!;
    const bar = solved.schedule.tasks.get(id)!;
    return { bar, facts: barFactsOf(task, bar, solved, alice, null, 0) };
  };

  it('reads a task alone at its share as held to it, not contended, not part-time', () => {
    const { bar, facts } = read([leaf({ nominalDays: 1, share: 0.2 })]);
    expect(bar.elapsedWorkingMinutes).toBe(5 * 480);
    expect(facts).toMatchObject({ contended: false, reduced: false, rates: [0.2] });
    const html = renderBarTooltip(facts);
    expect(html).toContain('Fixed at 20%');
    expect(html).toContain('Held to its fixed share');
    expect(html).not.toContain('does not work full time');
    expect(html).not.toContain('split with other tasks');
  });

  it('reads shares past the whole person as reduced', () => {
    const { facts } = read([leaf({ share: 0.8 }), leaf({ id: '2', share: 0.8 })]);
    expect(facts.reduced).toBe(true);
    expect(renderBarTooltip(facts)).toContain('reduced proportionally');
  });

  it('leaves an unfixed task squeezed by a fixed one an ordinary contended task', () => {
    const { facts } = read([leaf(), leaf({ id: '2', share: 0.8 })]);
    expect(facts).toMatchObject({ contended: true, reduced: false });
    expect('pace' in facts).toBe(false);
  });

  it('does not call a split outside the fixed period a reduced share', () => {
    const { facts } = read([leaf({ shareOverrides: [period] }), leaf({ id: '2' })]);
    expect(facts).toMatchObject({ contended: true, reduced: false });
  });

  it('draws a pause as a stop in the profile: no segment, at full rate around it', () => {
    const tasks = [leaf({ shareOverrides: [period] })];
    const { bar, facts } = read(tasks);
    expect(bar.segments.map((segment) => segment.rate)).toEqual([1, 1]);
    expect(bar.elapsedWorkingMinutes).toBe(6 * 480);
    expect(drawsProfile(bar, hasShare(tasks[0]))).toBe(true);
    expect(renderBarTooltip(facts)).toContain('09/09–10/09 paused');
  });

  it('solves whatever the gate lets through, a whole task of pauses included', () => {
    const pace = parseTaskShare(0.01, [
      { fromDay: 0, toDay: 0, share: 0 },
      { fromDay: 2, toDay: 80, share: 0 },
      { fromDay: 1, toDay: 1, share: 1 },
    ]);
    expect(() => solve(project([leaf({ ...pace, resourceId: undefined })]))).not.toThrow();
  });
});

describe('the share a new period starts at', () => {
  const PER_DAY = 480;
  const seeded = (tasks: ProjectTask[], ordinal: number, resources = project(tasks).resources) => {
    const plan = { ...project(tasks), resources };
    const solved = solve(plan);
    return {
      plan,
      solved,
      share: seedShare(tasks[0], solved.schedule.tasks.get(tasks[0].id), ordinal, PER_DAY),
    };
  };
  const ends = (plan: Project) =>
    [...solve(plan).schedule.tasks.values()].map((task) => [task.id, task.end.getTime()]);

  it('is the half two equal tasks split their person at, and adding it moves nothing', () => {
    const tasks = [leaf(), leaf({ id: '2' })];
    const { plan, solved, share } = seeded(tasks, 1);
    expect(share).toBe(0.5);
    const added = seededSharePeriod(tasks[0], solved.schedule.tasks.get('1'), 1, PER_DAY);
    expect(added).toEqual({ fromDay: 1, toDay: 1, share: 0.5 });
    const after = { ...plan, tasks: [{ ...tasks[0], ...parseTaskShare(undefined, [added]) }, tasks[1]] };
    expect(ends(after)).toEqual(ends(plan));
  });

  it('is unrounded, so three tasks sharing one person stay where they were', () => {
    const tasks = [leaf(), leaf({ id: '2' }), leaf({ id: '3' })];
    const { plan, share } = seeded(tasks, 2);
    expect(share).toBeCloseTo(1 / 3, 12);
    const added = { fromDay: 2, toDay: 2, share };
    const after = { ...plan, tasks: [{ ...tasks[0], shareOverrides: [added] }, ...tasks.slice(1)] };
    expect(ends(after)).toEqual(ends(plan));
  });

  it('is a share of what the person gives, not of a full day', () => {
    const partTime = [{ id: 'alice', name: 'Alice', availability: 0.5 }];
    expect(seeded([leaf()], 1, partTime).share).toBe(1);
    expect(seeded([leaf(), leaf({ id: '2' })], 1, partTime).share).toBe(0.5);
  });

  it('is the share already in force where one is fixed', () => {
    expect(seeded([leaf({ share: 0.3 }), leaf({ id: '2' })], 1).share).toBe(0.3);
    expect(seeded([leaf({ shareOverrides: [{ ...period, share: 0.2 }] })], 2).share).toBe(0.2);
  });

  it('counts its day from where the task starts, not from where the plan does', () => {
    // Alone for two days, then splitting with a task that starts on the 9th...
    const first = leaf({ id: 'first', nominalDays: 6 });
    // ...and a task starting on the 9th itself, whose day 0 is that split day.
    const second = leaf({ id: 'second', nominalDays: 6, start: at(2) });
    expect(seeded([first, second], 0).share).toBe(1);
    expect(seeded([first, second], 2).share).toBe(0.5);
    expect(seeded([second, first], 0).share).toBe(0.5);
  });

  it('takes the nearest stretch the task runs in on a day it does not', () => {
    // A half each until the short one ends, then alone.
    const tasks = [leaf({ id: 'long', nominalDays: 6 }), leaf({ id: 'short', nominalDays: 1 })];
    // Far past the end: the last stretch ran alone.
    expect(seeded(tasks, 60).share).toBe(1);
    // A day its person is away, next to the split stretch.
    const away = [
      {
        id: 'alice',
        name: 'Alice',
        availabilityOverrides: [{ from: '2026-09-08', to: '2026-09-08', availability: 0 }],
      },
    ];
    expect(seeded([leaf({ nominalDays: 6 }), leaf({ id: '2', nominalDays: 0.5 })], 1, away).share).toBe(
      0.5,
    );
  });

  it('is 100% for a task that never runs, and never below the floor', () => {
    expect(seedShare({}, undefined, 0, PER_DAY)).toBe(1);
    const crowd = Array.from({ length: 150 }, (_, index) => leaf({ id: String(index) }));
    expect(seeded(crowd, 0).share).toBe(0.01);
  });
});

describe("a task's working days", () => {
  const day = (date: number) => dayIndexOf(new Date(2026, 8, date));
  /** Starts at 13:00 on Thursday 10 September and ends on Tuesday the 15th. */
  const held = () => {
    const tasks = [
      leaf({ id: 'before', nominalDays: 3.5, resourceId: undefined }),
      leaf({ id: 'held', nominalDays: 3, predecessors: ['before'] }),
    ];
    const solved = solve(project(tasks));
    return taskDays(solved.schedule.tasks.get('held')!, solved.calendar);
  };

  it('counts day 0 as the day the task starts in, whatever the hour', () => {
    const days = held();
    expect(days.dayOf(0)).toBe(day(10));
    expect(days.ordinalOf(day(10))).toBe(0);
    expect(days.ordinalAt(3.5 * 480)).toBe(0);
    expect(days.ordinalAt(4 * 480)).toBe(1);
  });

  it('does not count the weekend', () => {
    const days = held();
    expect([0, 1, 2, 3].map(days.dayOf)).toEqual([day(10), day(11), day(14), day(15)]);
    expect(days.ordinalOf(day(12))).toBeUndefined();
    expect(days.ordinalOf(day(14))).toBe(2);
    expect(days.ordinalFrom(day(12))).toBe(2);
  });

  it('ends on the day its last minute closes, not on the morning after', () => {
    expect(held().last).toBe(3);
    const whole = solve(project([leaf()]));
    expect(taskDays(whole.schedule.tasks.get('1')!, whole.calendar).last).toBe(3);
  });

  it('answers nothing for a day before the task', () => {
    const days = held();
    expect(days.ordinalOf(day(9))).toBeUndefined();
    expect(days.ordinalFrom(day(9))).toBe(-1);
  });

  it('takes a closed day inside the task for the working day nearest to it, none outside', () => {
    const days = held();
    expect(days.nearestOrdinal(day(12))).toBe(1);
    expect(days.nearestOrdinal(day(13))).toBe(2);
    expect(days.nearestOrdinal(day(11))).toBe(1);
    expect(days.nearestOrdinal(day(9))).toBeUndefined();
    expect(days.nearestOrdinal(day(16))).toBeUndefined();
  });

  it('skips a company shutdown like a weekend', () => {
    const closed: Project = {
      ...project([leaf()]),
      calendar: { ...DEFAULT_CALENDAR, holidays: [{ from: '2026-09-08', to: '2026-09-08' }] },
    };
    const solved = solve(closed);
    const days = taskDays(solved.schedule.tasks.get('1')!, solved.calendar);
    expect(days.dayOf(1)).toBe(day(9));
    expect(days.ordinalOf(day(8))).toBeUndefined();
    expect(days.last).toBe(3);
  });
});

describe('periods shown on their dates', () => {
  const solved = solve(project([leaf({ nominalDays: 8 })]));
  const days = taskDays(solved.schedule.tasks.get('1')!, solved.calendar);
  const periods = [
    { fromDay: 4, toDay: 5, share: 0.5, label: 'Audit' },
    { fromDay: 0, toDay: 0, share: 0 },
  ];

  it('dates a period across the weekend it spans, and reads it back unchanged', () => {
    const dated = datePeriods(periods, days);
    expect(dated).toEqual([
      { from: '2026-09-11', to: '2026-09-14', share: 0.5, label: 'Audit' },
      { from: '2026-09-07', to: '2026-09-07', share: 0 },
    ]);
    expect(undatePeriods(dated, days)).toEqual(periods);
  });

  it('gives a closed day at either end to the working day inside the period', () => {
    const weekend = [{ from: '2026-09-12', to: '2026-09-20', share: 0 }];
    expect(undatePeriods(weekend, days)).toEqual([{ fromDay: 5, toDay: 9, share: 0 }]);
  });

  it.each([
    [{ from: '2026-09-04', to: '2026-09-08', share: 0 }, /starts before the task does \(2026-09-07\)/],
    [{ from: '2026-09-12', to: '2026-09-13', share: 0 }, /covers no working day/],
    [{ from: '2026-09-09', to: '2026-09-08', share: 0 }, /ends before it starts/],
    [{ from: '2026-09-09', to: '', share: 0 }, /no start or end/],
    [{ from: '2026-02-30', to: '2026-03-02', share: 0 }, /malformed/],
  ])('refuses %j, naming the period', (entry, message) => {
    expect(() => undatePeriods([{ from: '2026-09-07', to: '2026-09-07', share: 0 }, entry], days)).toThrow(message);
    expect(() => undatePeriods([entry], days)).toThrow(/Share period 1/);
  });
});

describe('a period never reaches past its task', () => {
  const paced = (patch: Partial<ProjectTask>) => {
    const plan = project([leaf({ nominalDays: 6, ...patch })]);
    const solved = solve(plan);
    trimSharePeriods(plan, solved);
    return { plan, solved, task: plan.tasks[0], bar: solved.schedule.tasks.get('1')! };
  };
  const half = { fromDay: 3, toDay: 5, share: 0.5 };

  it('is left alone while the task runs past it', () => {
    const { task, bar, solved } = paced({ shareOverrides: [half] });
    // Three days at full rate, three at a half, a day and a half to finish.
    expect(bar.elapsedWorkingMinutes).toBe(7.5 * 480);
    expect(taskDays(bar, solved.calendar).last).toBe(7);
    expect(task.shareOverrides).toEqual([half]);
  });

  it('is left alone when it ends on the task\'s last day', () => {
    const { task, bar, solved } = paced({ shareOverrides: setLevel([half], 0, 1) });
    expect(taskDays(bar, solved.calendar).last).toBe(5);
    expect(task.shareOverrides).toEqual([{ ...half, share: 1 }]);
  });

  it('is cut back to the last day of a task that got shorter', () => {
    const { task, bar, solved, plan } = paced({ nominalDays: 3.25, shareOverrides: [half] });
    // The quarter day left for day 3 takes half of it at a half.
    expect(taskDays(bar, solved.calendar).last).toBe(3);
    expect(task.shareOverrides).toEqual([{ ...half, toDay: 3 }]);
    // Days past the end were inert: the trimmed plan solves to the same bar.
    expect(solve(plan).schedule.tasks.get('1')).toEqual(bar);
  });

  it('is removed once the task ends before it starts', () => {
    const { task, solved } = paced({ nominalDays: 3, shareOverrides: [half] });
    expect('shareOverrides' in task).toBe(false);
    expect('shareOverrides' in solved.engineTasks[0]).toBe(false);
  });

  it('cuts the engine\'s copy too, which the critical chain re-solves', () => {
    const { solved, task } = paced({ nominalDays: 3.25, shareOverrides: [half] });
    expect(solved.engineTasks[0].shareOverrides).toEqual(task.shareOverrides);
    expect(solved.engineTasks[0].shareOverrides).not.toBe(task.shareOverrides);
  });

  it('keeps the periods before the cut and their order, labels included', () => {
    const early = { fromDay: 0, toDay: 0, share: 0.5, label: 'Kickoff' };
    const late = { fromDay: 9, toDay: 9, share: 0 };
    expect(trimToTask([late, half, early], 4)).toEqual([{ ...half, toDay: 4 }, early]);
  });

  it('answers the list itself when nothing reaches past the end', () => {
    const periods = [half];
    expect(trimToTask(periods, 5)).toBe(periods);
    const { plan } = paced({ shareOverrides: periods });
    expect(plan.tasks[0].shareOverrides).toBe(periods);
  });

  it('leaves the inert periods of a milestone as they were declared', () => {
    const { task } = paced({ nominalDays: 0, shareOverrides: [half] });
    expect(task.shareOverrides).toEqual([half]);
  });
});

describe('a rename on a task paused on its first days', () => {
  it('hands back the solved start and leaves the declared one where it was', () => {
    const task = leaf({ shareOverrides: [{ fromDay: 0, toDay: 1, share: 0 }] });
    const solved = solve(project([task]));
    const bar = solved.schedule.tasks.get('1')!;
    expect(bar.start).toEqual(at(0));
    expect(bar.segments[0].start).toEqual(at(2));
    expect(constraintStart(task, bar.start, solved)).toBe(task.start);
    // And through the file: what is written is the declared start, and it reloads as it was.
    const reloaded = deserializeProject(serializeForFile(project([task]), solved));
    expect(reloaded.tasks[0].start).toEqual(task.start);
    expect(solve(reloaded).schedule.tasks.get('1')).toEqual(bar);
  });
});
