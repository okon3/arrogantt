import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR, dayIndexOf, type ScheduledTask } from '../scheduler';
import { barFactsOf, renderBarTooltip } from './barTooltip';
import { buildPlan } from './plan';
import { solve, type Project, type ProjectTask } from './project';
import { drawsProfile } from './segmentBar';
import {
  ProjectFileError,
  deserializeProject,
  serializeForFile,
  serializeProject,
} from './serialization';
import {
  hasShare,
  parseTaskShare,
  seedShare,
  seededSharePeriod,
  shareInForce,
} from './taskShare';

const at = (dayOffset: number) => new Date(2026, 8, 7 + dayOffset, 8, 0);
const period = { from: '2026-09-09', to: '2026-09-10', share: 0 };

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
    const later = { from: '2026-09-11', to: '2026-09-11', share: 0 };
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
      { from: '2026-09-10', to: '2026-09-10', share: 1, label: 'Crunch' },
      { from: '2026-09-09', to: '2026-09-09', share: 0 },
    ];
    expect(parseTaskShare(1, periods)).toEqual({ share: 1, shareOverrides: periods });
  });

  it('refuses two periods sharing a day, naming both as declared', () => {
    const week = { from: '2026-09-07', to: '2026-09-11', share: 0.5 };
    const wednesday = { from: '2026-09-09', to: '2026-09-09', share: 0 };
    const apart = { from: '2026-09-14', to: '2026-09-14', share: 0 };
    expect(() => parseTaskShare(undefined, [apart, wednesday, week])).toThrow(
      'Share periods 2 and 3 overlap (2026-09-09 and 2026-09-07 to 2026-09-11)',
    );
    expect(() => parseTaskShare(undefined, [week, { ...week, share: 0 }])).toThrow(/1 and 2 overlap/);
    // One day in common is an overlap; none, however close, is not.
    expect(() => parseTaskShare(undefined, [week, { ...apart, from: '2026-09-11' }])).toThrow(
      /overlap/,
    );
    const adjacent = [week, { from: '2026-09-12', to: '2026-09-14', share: 0 }];
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
    [{ to: '2026-09-10', share: 0 }, /no start or end/],
    [{ from: '2026-09-09', to: '', share: 0 }, /no start or end/],
    [{ from: '2026-9-9', to: '2026-09-10', share: 0 }, /malformed/],
    [{ from: '2026-02-30', to: '2026-03-02', share: 0 }, /malformed/],
    [{ from: '2026-09-11', to: '2026-09-10', share: 0 }, /ends before it starts/],
    ['2026-09-09', /expected \{ from, to, share \}/],
  ])('refuses the period %j', (entry, message) => {
    expect(() => parseTaskShare(undefined, [period, entry])).toThrow(message);
    expect(() => parseTaskShare(undefined, [period, entry])).toThrow(/Share period 2/);
  });

  it('refuses a period list that is not a list', () => {
    expect(() => parseTaskShare(undefined, { from: 'x' })).toThrow(/expected a list/);
  });
});

describe('shareInForce', () => {
  const task = {
    share: 0.5,
    shareOverrides: [
      { from: '2026-09-08', to: '2026-09-09', share: 0 },
      { from: '2026-09-10', to: '2026-09-10', share: 0.25 },
    ],
  };

  it('lets a period replace the default on its own days', () => {
    expect(shareInForce(task, at(0))).toBe(0.5);
    expect(shareInForce(task, at(1))).toBe(0);
    expect(shareInForce(task, at(3))).toBe(0.25);
    expect(shareInForce({ shareOverrides: task.shareOverrides }, at(0))).toBeUndefined();
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
    [{ shareOverrides: [{ from: '2026-09-09', share: 0 }] }, /no start or end/],
    [{ shareOverrides: [{ ...period, from: '2026-09-11' }] }, /ends before it starts/],
    [{ shareOverrides: [{ ...period, share: 2 }] }, /numeric "share"/],
    [{ shareOverrides: [{ from: period.from, to: period.to }] }, /numeric "share"/],
    [{ shareOverrides: [period, { ...period, from: period.to }] }, /periods 1 and 2 overlap/],
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
      { from: '2026-09-07', to: '2026-09-07', share: 0 },
      { from: '2026-09-09', to: '2026-12-31', share: 0 },
      { from: '2026-09-08', to: '2026-09-08', share: 1 },
    ]);
    expect(() => solve(project([leaf({ ...pace, resourceId: undefined })]))).not.toThrow();
  });
});

describe('the share a new period starts at', () => {
  const day = (offset: number) => dayIndexOf(at(offset));
  const seeded = (tasks: ProjectTask[], offset: number, resources = project(tasks).resources) => {
    const plan = { ...project(tasks), resources };
    const solved = solve(plan);
    return {
      plan,
      solved,
      share: seedShare(tasks[0], solved.schedule.tasks.get(tasks[0].id), day(offset), solved.calendar),
    };
  };
  const ends = (plan: Project) =>
    [...solve(plan).schedule.tasks.values()].map((task) => [task.id, task.end.getTime()]);

  it('is the half two equal tasks split their person at, and adding it moves nothing', () => {
    const tasks = [leaf(), leaf({ id: '2' })];
    const { plan, solved, share } = seeded(tasks, 1);
    expect(share).toBe(0.5);
    const added = seededSharePeriod(tasks[0], solved.schedule.tasks.get('1'), '2026-09-08', solved.calendar);
    expect(added).toEqual({ from: '2026-09-08', to: '2026-09-08', share: 0.5 });
    const after = { ...plan, tasks: [{ ...tasks[0], ...parseTaskShare(undefined, [added]) }, tasks[1]] };
    expect(ends(after)).toEqual(ends(plan));
  });

  it('is unrounded, so three tasks sharing one person stay where they were', () => {
    const tasks = [leaf(), leaf({ id: '2' }), leaf({ id: '3' })];
    const { plan, share } = seeded(tasks, 2);
    expect(share).toBeCloseTo(1 / 3, 12);
    const added = { from: '2026-09-09', to: '2026-09-09', share };
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

  it('takes the nearest stretch the task runs in on a day it does not', () => {
    // A half each until the short one ends, then alone.
    const tasks = [leaf({ id: 'long', nominalDays: 6 }), leaf({ id: 'short', nominalDays: 1 })];
    // Saturday 12 September: the week behind it ended alone.
    expect(seeded(tasks, 5).share).toBe(1);
    // The day before the plan starts: the first stretch is the split one.
    expect(seeded(tasks, -1).share).toBe(0.5);
    // Far past the end.
    expect(seeded(tasks, 60).share).toBe(1);
  });

  it('is 100% for a task that never runs, and never below the floor', () => {
    const calendar = solve(project([leaf()])).calendar;
    expect(seedShare({}, undefined, day(0), calendar)).toBe(1);
    const crowd = Array.from({ length: 150 }, (_, index) => leaf({ id: String(index) }));
    expect(seeded(crowd, 0).share).toBe(0.01);
  });
});

describe('a period seeded from a pointed day', () => {
  const calendar = solve(project([leaf()])).calendar;

  it('is left on a closed day, and passes the gate as it stands', () => {
    const saturday = seededSharePeriod({}, undefined, '2026-09-12', calendar);
    expect(saturday).toEqual({ from: '2026-09-12', to: '2026-09-12', share: 1 });
    expect(parseTaskShare(undefined, [saturday]).shareOverrides).toEqual([saturday]);
  });
});
