import { describe, expect, it } from 'vitest';
import { buildPlan } from './plan';
import { sampleProject, solve, type Project } from './project';
import { DEFAULT_CALENDAR } from '../scheduler';

const at = (dayOffset: number) => new Date(2026, 8, 7 + dayOffset, 8, 0);

const planOf = (project: Project) => buildPlan(solve(project));

describe('buildPlan', () => {
  it('returns every task exactly once', () => {
    const plan = planOf(sampleProject);
    expect(plan.tasks).toHaveLength(sampleProject.tasks.length);
    expect(new Set(plan.tasks.map((task) => task.id)).size).toBe(sampleProject.tasks.length);
  });

  it('puts a parent immediately before its own subtree, recursively', () => {
    // Declared out of tree order on purpose: project.tasks is not the tree.
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [],
      tasks: [
        { id: 'leaf', name: 'Foglia', nominalDays: 1, start: at(0), parentId: 'mid' },
        { id: 'last', name: 'Ultima', nominalDays: 1, start: at(0) },
        { id: 'top', name: 'Cima', nominalDays: 1, start: at(0) },
        { id: 'mid', name: 'Mezzo', nominalDays: 1, start: at(0), parentId: 'top' },
        { id: 'first', name: 'Prima', nominalDays: 1, start: at(0) },
      ],
    };
    expect(planOf(project).tasks.map((task) => `${'  '.repeat(task.depth)}${task.id}`)).toEqual([
      'last',
      'top',
      '  mid',
      '    leaf',
      'first',
    ]);
  });

  it('is stable: the same project yields identical output twice', () => {
    expect(JSON.stringify(planOf(sampleProject))).toBe(JSON.stringify(planOf(sampleProject)));
  });

  it('writes dates as local wall clock, never as UTC', () => {
    const plan = planOf(sampleProject);
    expect(plan.tasks[0].start).toBe('2026-09-07T08:00');
    expect(plan.projectStart).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('rolls a summary up and leaves it without a resource', () => {
    const plan = planOf(sampleProject);
    const summary = plan.tasks.find((task) => task.id === '7');
    expect(summary).toMatchObject({ isSummary: true, parentId: null, resourceId: null });
    // Its two children declare two and one day of effort.
    expect(summary?.effortDays).toBeCloseTo(3);
  });

  it('hides the resource a summary kept from before it had children', () => {
    // A leaf assigned to r1 that later gained a child keeps its own resourceId
    // in the model, where it is inert; reading it out would report an
    // assignment nobody is working.
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [
        { id: 'r1', name: 'Marta' },
        { id: 'r2', name: 'Gino' },
      ],
      tasks: [
        { id: 'group', name: 'Gruppo', nominalDays: 0, start: at(0), resourceId: 'r1' },
        { id: 'work', name: 'Lavoro', nominalDays: 2, start: at(0), resourceId: 'r2', parentId: 'group' },
      ],
    };
    const [group, work] = planOf(project).tasks;
    expect(group).toMatchObject({ id: 'group', isSummary: true, resourceId: null });
    expect(work).toMatchObject({ id: 'work', resourceId: 'r2' });
  });

  it('reports contention as shared, with elapsed above effort', () => {
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [{ id: 'r1', name: 'Marta' }],
      tasks: [
        { id: '1', name: 'Una', nominalDays: 2, start: at(0), resourceId: 'r1' },
        { id: '2', name: 'Due', nominalDays: 2, start: at(0), resourceId: 'r1' },
      ],
    };
    for (const task of planOf(project).tasks) {
      expect(task.shared).toBe(true);
      expect(task.elapsedDays).toBeGreaterThan(task.effortDays);
    }
  });

  it('does not call part-time shared, though it stretches just as much', () => {
    // The distinction the caller acts on: contention means move a task,
    // part-time means change the person.
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [{ id: 'r1', name: 'Marta', availability: 0.5 }],
      tasks: [{ id: '1', name: 'Una', nominalDays: 2, start: at(0), resourceId: 'r1' }],
    };
    const [task] = planOf(project).tasks;
    expect(task.shared).toBe(false);
    expect(task.elapsedDays).toBeCloseTo(4);
    expect(task.effortDays).toBeCloseTo(2);
  });

  it('does not call an absence shared either', () => {
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [
        {
          id: 'r1',
          name: 'Marta',
          availabilityOverrides: [{ from: '2026-09-08', to: '2026-09-09', availability: 0 }],
        },
      ],
      tasks: [{ id: '1', name: 'Una', nominalDays: 3, start: at(0), resourceId: 'r1' }],
    };
    const [task] = planOf(project).tasks;
    expect(task.shared).toBe(false);
    expect(task.elapsedDays).toBeGreaterThan(task.effortDays);
  });

  it('calls contention on a part-timer shared, since it is still contention', () => {
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [{ id: 'r1', name: 'Marta', availability: 0.5 }],
      tasks: [
        { id: '1', name: 'Una', nominalDays: 2, start: at(0), resourceId: 'r1' },
        { id: '2', name: 'Due', nominalDays: 2, start: at(0), resourceId: 'r1' },
      ],
    };
    for (const task of planOf(project).tasks) expect(task.shared).toBe(true);
  });

  it('flags a disabled row, and the summary of a branch that is all placeholder', () => {
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [{ id: 'r1', name: 'Marta' }],
      tasks: [
        { id: 'p', name: 'Gruppo', nominalDays: 0, start: at(0), disabled: true },
        { id: 'c', name: 'Segnaposto', nominalDays: 2, start: at(0), parentId: 'p', resourceId: 'r1' },
        { id: 'live', name: 'Lavoro', nominalDays: 1, start: at(0), resourceId: 'r1' },
      ],
    };
    const rows = new Map(planOf(project).tasks.map((task) => [task.id, task.disabled]));
    expect(rows.get('p')).toBe(true);
    expect(rows.get('c')).toBe(true);
    expect(rows.get('live')).toBe(false);
  });

  it('leaves an unassigned task unshared at full rate', () => {
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [],
      tasks: [
        { id: '1', name: 'Una', nominalDays: 2, start: at(0) },
        { id: '2', name: 'Due', nominalDays: 2, start: at(0) },
      ],
    };
    for (const task of planOf(project).tasks) {
      expect(task).toMatchObject({ shared: false, resourceId: null });
      expect(task.elapsedDays).toBeCloseTo(task.effortDays);
    }
  });
});

describe('buildPlan — cost', () => {
  // Marta is priced, Luca is not, and the milestone owns no effort at all: one
  // tree covers the three answers a cost cell can give.
  const priced: Project = {
    calendar: DEFAULT_CALENDAR,
    resources: [
      { id: 'r1', name: 'Marta', dailyRate: 600 },
      { id: 'r2', name: 'Luca' },
    ],
    tasks: [
      { id: 'S1', name: 'Gruppo', nominalDays: 0, start: at(0) },
      { id: 'T1', name: 'Una', nominalDays: 4, start: at(0), resourceId: 'r1', parentId: 'S1' },
      { id: 'T2', name: 'Due', nominalDays: 3, start: at(0), resourceId: 'r2', parentId: 'S1' },
      { id: 'M1', name: 'Consegna', nominalDays: 0, start: at(0) },
    ],
  };
  const rowsOf = (project: Project) => new Map(planOf(project).tasks.map((t) => [t.id, t]));

  it('prices a leaf at its own rate', () => {
    expect(rowsOf(priced).get('T1')).toMatchObject({
      cost: 2400,
      uncostedDays: 0,
      dailyRates: [600],
    });
  });

  it('reports an unpriced leaf as null, not as zero, with its effort uncosted', () => {
    expect(rowsOf(priced).get('T2')).toMatchObject({
      cost: null,
      uncostedDays: 3,
      dailyRates: [],
    });
  });

  it('costs a milestone zero: it has no effort to leave uncosted', () => {
    expect(rowsOf(priced).get('M1')).toMatchObject({
      cost: 0,
      uncostedDays: 0,
      dailyRates: [],
    });
  });

  it('rolls a summary up to its costed children and keeps the rest uncosted', () => {
    // The lower bound the UI marks with an aggregate sign, plus what it excludes.
    expect(rowsOf(priced).get('S1')).toMatchObject({
      cost: 2400,
      uncostedDays: 3,
      dailyRates: [],
    });
  });

  it('totals the top-level rows, never every row', () => {
    const plan = planOf(priced);
    expect(plan.totalCost).toBe(2400);
    expect(plan.uncostedDays).toBe(3);
    // Summing every row would count the summary and its children both: 4800.
    const everyRow = plan.tasks.reduce((sum, task) => sum + (task.cost ?? 0), 0);
    expect(everyRow).toBe(4800);
  });

  it('has no total to show when nothing in the plan was costed', () => {
    const unpriced = { ...priced, resources: [{ id: 'r2', name: 'Luca' }] };
    const plan = planOf({ ...unpriced, tasks: priced.tasks.filter((t) => t.id !== 'T1') });
    expect(plan.totalCost).toBeNull();
    expect(plan.uncostedDays).toBe(3);
    expect(planOf({ ...priced, tasks: [] }).totalCost).toBeNull();
  });

  it('leaves a disabled top-level row out of the total, as its effort is', () => {
    // Nothing above it applies the roll-up's exclusion, so the total must.
    const withPlaceholder: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [{ id: 'r1', name: 'Marta', dailyRate: 600 }],
      tasks: [
        { id: 'T1', name: 'Una', nominalDays: 4, start: at(0), resourceId: 'r1' },
        {
          id: 'T6',
          name: 'Segnaposto',
          nominalDays: 5,
          start: at(0),
          resourceId: 'r1',
          disabled: true,
        },
      ],
    };
    const plan = planOf(withPlaceholder);
    expect(plan.totalCost).toBe(2400);
    // Priced on its own row all the same: dimmed, not blank.
    expect(plan.tasks.find((task) => task.id === 'T6')?.cost).toBe(3000);
  });

  it('has no total when every top-level row is a placeholder', () => {
    const allPlaceholders: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [{ id: 'r1', name: 'Marta', dailyRate: 600 }],
      tasks: [
        { id: 'S1', name: 'Gruppo', nominalDays: 0, start: at(0) },
        {
          id: 'T1',
          name: 'Una',
          nominalDays: 4,
          start: at(0),
          resourceId: 'r1',
          parentId: 'S1',
          disabled: true,
        },
      ],
    };
    const plan = planOf(allPlaceholders);
    expect(plan.totalCost).toBeNull();
    expect(plan.uncostedDays).toBe(0);
    // A summary all of whose leaves are disabled still carries their figure.
    expect(plan.tasks.find((task) => task.id === 'S1')?.cost).toBe(2400);
  });

  it('carries the project currency label onto the plan, or nothing', () => {
    expect(planOf({ ...priced, currency: 'EUR' }).currency).toBe('EUR');
    expect(planOf(priced).currency).toBeNull();
  });
});
