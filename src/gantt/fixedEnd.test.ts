import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CALENDAR } from '../scheduler';
import { createAgentApi } from './agentApi';
import type { GanttHandle, TaskDetails } from './ganttHandle';
import { buildPlan } from './plan';
import {
  closeGaps,
  fixedEndOn,
  isMilestone,
  moveFixed,
  slackByRow,
  solve,
  type Project,
  type ProjectTask,
} from './project';
import { deserializeProject, serializeForFile, serializeProject } from './serialization';
import { parseTaskShare } from './taskShare';

/** Monday 7 September 2026 is day 0. */
const open = (dayOffset: number) => new Date(2026, 8, 7 + dayOffset, 8, 0);
const close = (dayOffset: number) => new Date(2026, 8, 7 + dayOffset, 17, 0);

function project(tasks: ProjectTask[]): Project {
  return { calendar: DEFAULT_CALENDAR, resources: [{ id: 'alice', name: 'Alice' }], tasks };
}

const leaf = (id: string, extra: Partial<ProjectTask> = {}): ProjectTask => ({
  id,
  name: id,
  nominalDays: 5,
  start: open(0),
  resourceId: 'alice',
  ...extra,
});

const spanOf = (solved: ReturnType<typeof solve>, id: string) => {
  const scheduled = solved.schedule.tasks.get(id)!;
  return [scheduled.start, scheduled.end];
};

describe('a task with a fixed end, solved', () => {
  it('runs from its start to its end, and reports the work that went in', () => {
    const solved = solve(project([leaf('a', { fixedEnd: close(1) }), leaf('b')]));
    expect(spanOf(solved, 'a')).toEqual([open(0), close(1)]);
    // Two days shared with b: one day of work, whatever the estimate of 5 says.
    expect(solved.calendar.minutesToDays(solved.schedule.tasks.get('a')!.effortMinutes)).toBe(1);
    // b did 1 of its 5 in those two days, and has Alice to itself for the other
    // 4: six working days, closing on the Monday after.
    expect(spanOf(solved, 'b')[1]).toEqual(close(7));
  });

  it('is held by no dependency, and holds what follows it', () => {
    const solved = solve(
      project([
        leaf('late', { nominalDays: 8, resourceId: undefined }),
        leaf('a', { fixedEnd: close(1), predecessors: ['late'], resourceId: undefined }),
        leaf('next', { nominalDays: 1, predecessors: ['a'], resourceId: undefined }),
      ]),
    );
    expect(spanOf(solved, 'a')).toEqual([open(0), close(1)]);
    expect(spanOf(solved, 'next')).toEqual([open(2), close(2)]);
  });

  it('is a bar with no estimate, not a milestone', () => {
    const tasks = [leaf('a', { nominalDays: 0, fixedEnd: close(1) })];
    expect(isMilestone(tasks[0], new Set())).toBe(false);
    expect(spanOf(solve(project(tasks)), 'a')).toEqual([open(0), close(1)]);
  });

  it('paused throughout, takes nothing from the task beside it', () => {
    const solved = solve(
      project([leaf('extra', { fixedEnd: close(4), share: 0 }), leaf('b', { nominalDays: 3 })]),
    );
    expect(spanOf(solved, 'extra')).toEqual([open(0), close(4)]);
    expect(spanOf(solved, 'b')).toEqual([open(0), close(2)]);
  });

  it('is not pulled back by closing the gaps of its group', () => {
    const tasks = [
      leaf('g', { nominalDays: 0 }),
      leaf('first', { parentId: 'g', nominalDays: 1 }),
      leaf('a', { parentId: 'g', start: open(3), fixedEnd: close(4), predecessors: ['first'] }),
    ];
    const before = project(tasks);
    expect(closeGaps(before, solve(before), 'g')).toBe(before.tasks);
  });

  it('is left out of the float measurement', () => {
    const plan = project([leaf('a', { fixedEnd: close(1) }), leaf('b')]);
    const rows = slackByRow(plan, solve(plan));
    expect(rows.has('a')).toBe(false);
    expect(rows.get('b')!.isCritical).toBe(true);
  });

  it('says in the plan that its dates were declared', () => {
    const rows = buildPlan(solve(project([leaf('a', { fixedEnd: close(1) }), leaf('b')]))).tasks;
    expect(rows[0]).toMatchObject({ fixedEnd: '2026-09-08T17:00', end: '2026-09-08T17:00' });
    expect('fixedEnd' in rows[1]).toBe(false);
  });
});

describe('the end a fixed task keeps', () => {
  const { calendar } = solve(project([leaf('a')]));

  it('is the close of the day it was given', () => {
    expect(fixedEndOn(calendar, open(0), new Date(2026, 8, 9))).toEqual(close(2));
  });

  it('on a closed day, is the close of the working day before', () => {
    // Saturday 12 September.
    expect(fixedEndOn(calendar, open(0), new Date(2026, 8, 12, 10, 0))).toEqual(close(4));
  });

  it('is never before the day the task starts on', () => {
    expect(fixedEndOn(calendar, open(2), new Date(2026, 8, 7))).toEqual(close(2));
  });
});

describe('moving a fixed task', () => {
  const plan = project([leaf('a', { start: open(2), fixedEnd: close(4) }), leaf('b')]);
  const solved = solve(plan);

  it('keeps it as many working days long, across a weekend', () => {
    const moved = moveFixed(plan.tasks[0], new Date(2026, 8, 10, 14, 0), solved, plan.calendar);
    // Thursday to the Monday after: three working days.
    expect([moved.start, moved.fixedEnd]).toEqual([open(3), close(7)]);
  });

  it('can go before the day the plan starts on', () => {
    const moved = moveFixed(plan.tasks[0], new Date(2026, 8, 1, 9, 0), solved, plan.calendar);
    expect([moved.start, moved.fixedEnd]).toEqual([open(-6), close(-4)]);
  });

  it('is the same task when dropped on the day it has', () => {
    expect(moveFixed(plan.tasks[0], new Date(2026, 8, 9, 15, 0), solved, plan.calendar)).toBe(
      plan.tasks[0],
    );
  });
});

describe('a fixed end in the file', () => {
  it('survives a round trip, report or not', () => {
    const plan = project([leaf('a', { fixedEnd: close(1) }), leaf('b')]);
    expect(deserializeProject(serializeProject(plan)).tasks[0].fixedEnd).toEqual(close(1));
    const reopened = deserializeProject(serializeForFile(plan, solve(plan)));
    expect(reopened.tasks[0].fixedEnd).toEqual(close(1));
    expect('fixedEnd' in reopened.tasks[1]).toBe(false);
  });

  it('is not written on a summary, where it is inert', () => {
    const plan = project([leaf('g', { fixedEnd: close(1) }), leaf('child', { parentId: 'g' })]);
    expect('fixedEnd' in deserializeProject(serializeProject(plan)).tasks[0]).toBe(false);
  });

  it('is refused on a day before the start', () => {
    const text = serializeProject(project([leaf('a', { start: open(2), fixedEnd: close(1) })]));
    expect(() => deserializeProject(text)).toThrow('tasks[0]: fixedEnd comes before start');
  });

  it('is refused malformed', () => {
    const text = serializeProject(project([leaf('a')])).replace('"start"', '"fixedEnd":"soon","start"');
    expect(() => deserializeProject(text)).toThrow(/fixedEnd: malformed date/);
  });
});

describe('a default share of zero', () => {
  it('is a share only where the end is fixed', () => {
    expect(parseTaskShare(0, undefined, true)).toEqual({ share: 0 });
    expect(() => parseTaskShare(0, undefined)).toThrow(/would never finish/);
  });

  it('solves to a bar that takes nothing, and reopens from its file', () => {
    const plan = project([leaf('extra', { fixedEnd: close(4), share: 0 }), leaf('b', { nominalDays: 3 })]);
    const reopened = deserializeProject(serializeForFile(plan, solve(plan)));
    expect(reopened.tasks[0]).toMatchObject({ share: 0, fixedEnd: close(4) });
    expect(spanOf(solve(reopened), 'b')).toEqual([open(0), close(2)]);
  });

  it('is refused in a file with no fixed end beside it', () => {
    const text = serializeProject(project([leaf('a', { share: 0 })]));
    expect(() => deserializeProject(text)).toThrow(/would never finish/);
  });
});

describe('agent API fixedEnd', () => {
  const details: TaskDetails = {
    id: 't1',
    name: 'Analisi',
    nominalDays: 2,
    start: open(2),
    end: close(3),
    resourceId: '',
    color: undefined,
    paintedColor: '#3b82f6',
    autoColor: '#3b82f6',
    ownsColor: true,
    progress: 0,
    isSummary: false,
    descendantCount: 0,
    elapsedDays: 2,
    effortDays: 2,
    shared: false,
    contended: false,
    disabled: false,
    cost: null,
    uncostedDays: 2,
    dailyRates: [],
    currency: null,
  };

  function harness(task: TaskDetails = details) {
    const handle = {
      getResources: () => [],
      getTaskDetails: (id: string) => (id === task.id ? task : null),
      addTask: vi.fn(() => 'tNew'),
      updateTask: vi.fn(),
    };
    const api = createAgentApi({
      handle: () => handle as unknown as GanttHandle,
      filename: () => 'piano.gantt',
      dirty: () => false,
      setFilename: () => {},
      adopt: () => {},
      newProject: () => {},
    });
    return { api, handle };
  }

  it('hands a date through, null to clear, and nothing when left alone', () => {
    const { api, handle } = harness();
    api.updateTask('t1', { fixedEnd: '2026-09-11T17:00' });
    expect(handle.updateTask).toHaveBeenLastCalledWith(
      't1',
      expect.objectContaining({ fixedEnd: close(4) }),
    );
    api.updateTask('t1', { fixedEnd: null });
    expect(handle.updateTask).toHaveBeenLastCalledWith('t1', expect.objectContaining({ fixedEnd: null }));
    api.updateTask('t1', { name: 'x' });
    expect(handle.updateTask.mock.lastCall![1].fixedEnd).toBeUndefined();
  });

  it('refuses an end before the start, and a start moved past the end it keeps', () => {
    const { api, handle } = harness({ ...details, fixedEnd: close(3) });
    expect(() => api.updateTask('t1', { fixedEnd: '2026-09-08T17:00' })).toThrow(/comes before the start/);
    expect(() => api.updateTask('t1', { start: '2026-09-14T08:00' })).toThrow(/comes before the start/);
    expect(handle.updateTask).not.toHaveBeenCalled();
  });

  it('takes a share of zero with a fixed end, and keeps the end while the share is zero', () => {
    const { api, handle } = harness();
    api.updateTask('t1', { fixedEnd: '2026-09-11T17:00', share: 0 });
    expect(handle.updateTask).toHaveBeenLastCalledWith('t1', expect.objectContaining({ share: 0 }));
    expect(() => api.updateTask('t1', { share: 0 })).toThrow(/would never finish/);

    const paused = harness({ ...details, fixedEnd: close(3), share: 0 });
    expect(() => paused.api.updateTask('t1', { fixedEnd: null })).toThrow(/would never finish/);
    expect(paused.handle.updateTask).not.toHaveBeenCalled();
    paused.api.updateTask('t1', { fixedEnd: null, share: null });
    expect(paused.handle.updateTask).toHaveBeenCalledTimes(1);
  });

  it('refuses it on a summary and on addTask', () => {
    const { api } = harness({ ...details, isSummary: true });
    expect(() => api.updateTask('t1', { fixedEnd: '2026-09-11T17:00' })).toThrow(/summary task/);
    expect(() => api.addTask({ fixedEnd: '2026-09-11T17:00' } as never)).toThrow(
      'addTask does not set fixedEnd: call updateTask(id, { fixedEnd })',
    );
  });

  it('reports it as text', () => {
    const { api } = harness({ ...details, fixedEnd: close(3) });
    expect(api.getTask('t1').fixedEnd).toBe('2026-09-10T17:00');
    expect('fixedEnd' in harness().api.getTask('t1')).toBe(false);
  });
});
