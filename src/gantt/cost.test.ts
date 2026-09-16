import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CALENDAR,
  WorkingCalendar,
  dateOfDay,
  dayIndexOf,
  dayIndexOfString,
  dayStringOf,
} from '../scheduler';
import { sampleProject, solve, type Project } from './project';
import {
  rateIntervals,
  rateOnDay,
  reportedCost,
  taskCosts,
  validateCurrency,
  type Person,
  type RateOverride,
  type TaskCost,
} from './cost';

const at = (dayOffset: number) => new Date(2026, 8, 7 + dayOffset, 8, 0);

describe('rateOnDay', () => {
  const on = (person: Person, isoDay: string) => rateOnDay(person, dayIndexOfString(isoDay));

  it('falls back to the default outside every period', () => {
    expect(on({ id: 'r1', name: 'Marta', dailyRate: 600 }, '2026-09-07')).toBe(600);
  });

  it('replaces the default rather than adding to it', () => {
    const person: Person = {
      id: 'r1',
      name: 'Marta',
      dailyRate: 600,
      rateOverrides: [{ from: '2026-09-08', to: '2026-09-09', dailyRate: 650 }],
    };
    expect(on(person, '2026-09-08')).toBe(650);
    expect(on(person, '2026-09-10')).toBe(600);
  });

  it('lets the last declared period win over an earlier one', () => {
    const person: Person = {
      id: 'r1',
      name: 'Marta',
      dailyRate: 600,
      rateOverrides: [
        { from: '2026-09-07', to: '2026-09-11', dailyRate: 650 },
        { from: '2026-09-09', to: '2026-09-09', dailyRate: 700 },
      ],
    };
    expect(on(person, '2026-09-08')).toBe(650);
    expect(on(person, '2026-09-09')).toBe(700);
  });

  it('is undefined outside the overrides when no default is declared', () => {
    const person: Person = {
      id: 'r1',
      name: 'Luca',
      rateOverrides: [{ from: '2026-09-07', to: '2026-09-11', dailyRate: 400 }],
    };
    expect(on(person, '2026-09-01')).toBeUndefined();
    expect(on(person, '2026-09-08')).toBe(400);
  });

  it('answers with no rate at all when nothing is declared', () => {
    expect(on({ id: 'r1', name: 'Luca' }, '2026-09-07')).toBeUndefined();
  });

  it('reads a declared zero as a value, never as absent', () => {
    expect(on({ id: 'r1', name: 'Gino', dailyRate: 0 }, '2026-09-07')).toBe(0);
    const person: Person = {
      id: 'r1',
      name: 'Gino',
      dailyRate: 600,
      rateOverrides: [{ from: '2026-09-08', to: '2026-09-09', dailyRate: 0 }],
    };
    expect(on(person, '2026-09-08')).toBe(0);
  });

  it('tolerates a reversed period', () => {
    const person: Person = {
      id: 'r1',
      name: 'Marta',
      dailyRate: 600,
      rateOverrides: [{ from: '2026-09-11', to: '2026-09-09', dailyRate: 700 }],
    };
    expect(on(person, '2026-09-10')).toBe(700);
  });

  it('skips a malformed bound rather than throwing', () => {
    const person: Person = {
      id: 'r1',
      name: 'Marta',
      dailyRate: 600,
      rateOverrides: [{ from: '07/09/2026', to: '2026-09-11', dailyRate: 700 }],
    };
    expect(on(person, '2026-09-08')).toBe(600);
  });
});

describe('validateCurrency', () => {
  it('accepts a short trimmed label', () => {
    expect(validateCurrency('EUR')).toBeNull();
    expect(validateCurrency('k€')).toBeNull();
  });

  it('accepts exactly 8 characters', () => {
    expect(validateCurrency('12345678')).toBeNull();
  });

  it('refuses a label that is not already trimmed', () => {
    expect(validateCurrency(' EUR ')).toBe('Currency: a short label of up to 8 characters');
  });

  it('refuses an empty label', () => {
    expect(validateCurrency('')).toBe('Currency: a short label of up to 8 characters');
  });

  it('refuses a label over 8 characters', () => {
    expect(validateCurrency('123456789')).toBe('Currency: a short label of up to 8 characters');
  });

  // A script reaching the agent API is not bound by the signature: answering is
  // the rule's job, throwing a TypeError is not.
  it('refuses what is not a string at all', () => {
    expect(validateCurrency(5 as unknown as string)).toBe(
      'Currency: a short label of up to 8 characters',
    );
    expect(validateCurrency(undefined as unknown as string)).toBe(
      'Currency: a short label of up to 8 characters',
    );
  });
});

describe('reportedCost', () => {
  const cost = (overrides: Partial<TaskCost> = {}): TaskCost => ({
    amount: 0,
    costedDays: 0,
    uncostedDays: 0,
    dailyRates: [],
    ...overrides,
  });

  it('answers null when nothing was costed', () => {
    expect(reportedCost(cost({ costedDays: 0, uncostedDays: 3 }))).toBeNull();
  });

  it('answers the amount, even zero, once anything was costed', () => {
    expect(reportedCost(cost({ amount: 1600, costedDays: 4 }))).toBe(1600);
    expect(reportedCost(cost({ amount: 0, costedDays: 1 }))).toBe(0);
  });

  it('answers the amount on a milestone: no effort at all to leave uncosted', () => {
    expect(reportedCost(cost({ amount: 0, costedDays: 0, uncostedDays: 0 }))).toBe(0);
  });
});

describe('rateIntervals', () => {
  const calendar = new WorkingCalendar(at(0));
  const marta = (rateOverrides: RateOverride[]): Person => ({
    id: 'marta',
    name: 'Marta',
    dailyRate: 600,
    rateOverrides,
  });

  it('collapses a period that falls entirely on a weekend', () => {
    // 2026-09-12 and 2026-09-13 are a Saturday and a Sunday.
    const weekend = marta([{ from: '2026-09-12', to: '2026-09-13', dailyRate: 650 }]);
    expect(rateIntervals(weekend, calendar)).toEqual([]);
  });

  it('merges consecutive days at the same rate into one interval', () => {
    const intervals = rateIntervals(
      marta([{ from: '2026-09-07', to: '2026-09-09', dailyRate: 650 }]),
      calendar,
    );
    expect(intervals).toHaveLength(1);
    expect(intervals[0].dailyRate).toBe(650);
    expect(calendar.minutesToDays(intervals[0].to - intervals[0].from)).toBe(3);
  });

  it('splits where a narrower period declares a different rate', () => {
    const intervals = rateIntervals(
      marta([
        { from: '2026-09-07', to: '2026-09-11', dailyRate: 650 },
        { from: '2026-09-09', to: '2026-09-09', dailyRate: 700 },
      ]),
      calendar,
    );
    expect(intervals.map((interval) => interval.dailyRate)).toEqual([650, 700, 650]);
  });
});

describe('taskCosts', () => {
  const costsOf = (project: Project) => {
    const solved = solve(project);
    return { solved, costs: taskCosts(project, solved) };
  };

  /**
   * `steps` working days after the day `from` falls on, as a day bound.
   *
   * Every fixture below reads its rate boundaries off the solved schedule rather
   * than restating the arithmetic the engine already did.
   */
  const workingDaysAfter = (calendar: WorkingCalendar, from: Date, steps: number): string => {
    let day = dayIndexOf(from);
    for (let stepped = 0; stepped < steps; stepped += 1) {
      day += 1;
      while (!calendar.isWorkingDate(dateOfDay(day))) day += 1;
    }
    return dayStringOf(day);
  };

  const expectEffortConserved = (project: Project) => {
    const { solved, costs } = costsOf(project);
    let costed = 0;
    let uncosted = 0;
    let effort = 0;
    for (const task of project.tasks) {
      if (solved.hierarchy.isSummary(task.id)) continue;
      const scheduled = solved.schedule.tasks.get(task.id)!;
      const cost = costs.get(task.id)!;
      const effortDays = solved.calendar.minutesToDays(scheduled.effortMinutes);
      expect(cost.costedDays + cost.uncostedDays, task.id).toBeCloseTo(effortDays, 6);
      costed += cost.costedDays;
      uncosted += cost.uncostedDays;
      effort += effortDays;
    }
    expect(costed + uncosted).toBeCloseTo(effort, 6);
    return { solved, costs, costed, uncosted, effort };
  };

  // Contention on Marta, a half-time Gino, a zero-availability period, a rate
  // change inside a task, an override with no default under it, a disabled leaf
  // under a live summary, a milestone, an unassigned leaf, three levels of tree.
  const kitchenSink: Project = {
    calendar: DEFAULT_CALENDAR,
    resources: [
      {
        id: 'marta',
        name: 'Marta',
        dailyRate: 500,
        rateOverrides: [{ from: '2026-09-14', to: '2026-12-31', dailyRate: 700 }],
      },
      { id: 'gino', name: 'Gino', availability: 0.5, dailyRate: 300 },
      {
        id: 'luca',
        name: 'Luca',
        availabilityOverrides: [{ from: '2026-09-10', to: '2026-09-11', availability: 0 }],
        rateOverrides: [{ from: '2026-09-07', to: '2026-09-09', dailyRate: 250 }],
      },
    ],
    tasks: [
      { id: 'root', name: 'Radice', nominalDays: 0, start: at(0) },
      { id: 'mid', name: 'Mezzo', nominalDays: 0, start: at(0), parentId: 'root' },
      { id: 'a', name: 'A', nominalDays: 6, start: at(0), resourceId: 'marta', parentId: 'mid' },
      { id: 'b', name: 'B', nominalDays: 4, start: at(0), resourceId: 'marta', parentId: 'mid' },
      {
        id: 'dis',
        name: 'Sospesa',
        nominalDays: 3,
        start: at(0),
        resourceId: 'gino',
        parentId: 'mid',
        disabled: true,
      },
      { id: 'c', name: 'C', nominalDays: 4, start: at(0), resourceId: 'gino', parentId: 'root' },
      { id: 'd', name: 'D', nominalDays: 5, start: at(0), resourceId: 'luca', parentId: 'root' },
      { id: 'ms', name: 'Traguardo', nominalDays: 0, start: at(0) },
      { id: 'free', name: 'Senza nessuno', nominalDays: 2, start: at(0) },
    ],
  };

  it('conserves effort on every leaf of the sample project, none of them priced', () => {
    const { costs, costed, uncosted, effort } = expectEffortConserved(sampleProject);
    expect(costed).toBe(0);
    expect(uncosted).toBeCloseTo(effort, 6);
    for (const cost of costs.values()) {
      expect(cost.amount).toBe(0);
      expect(cost.dailyRates).toEqual([]);
    }
  });

  it('conserves effort on every leaf of a project with every case in it', () => {
    const { costed, uncosted } = expectEffortConserved(kitchenSink);
    // Both halves carry work, or conservation would be closing over one path only.
    expect(costed).toBeGreaterThan(0);
    expect(uncosted).toBeGreaterThan(0);
  });

  it('splits a task crossing a rate change by person-days', () => {
    const person: Person = { id: 'p', name: 'Priced', dailyRate: 100 };
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [person],
      tasks: [{ id: 't', name: 'T', nominalDays: 4, start: at(0), resourceId: 'p' }],
    };
    const { solved } = costsOf(project);
    const from = workingDaysAfter(solved.calendar, solved.schedule.tasks.get('t')!.start, 2);
    const withRise: Project = {
      ...project,
      resources: [{ ...person, rateOverrides: [{ from, to: '2026-12-31', dailyRate: 200 }] }],
    };
    expect(costsOf(withRise).costs.get('t')).toEqual({
      amount: 600,
      costedDays: 4,
      uncostedDays: 0,
      dailyRates: [100, 200],
    });
  });

  it('prices a half-time person by effort, not by the days it is spread over', () => {
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [{ id: 'gino', name: 'Gino', availability: 0.5, dailyRate: 400 }],
      tasks: [{ id: 't', name: 'T', nominalDays: 4, start: at(0), resourceId: 'gino' }],
    };
    const { solved, costs } = costsOf(project);
    const scheduled = solved.schedule.tasks.get('t')!;
    expect(solved.calendar.minutesToDays(scheduled.elapsedWorkingMinutes)).toBeCloseTo(8, 6);
    expect(costs.get('t')).toEqual({
      amount: 1600,
      costedDays: 4,
      uncostedDays: 0,
      dailyRates: [400],
    });
  });

  it('counts a declared rate of zero as costed, not as absent', () => {
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [{ id: 'stagista', name: 'Stagista', dailyRate: 0 }],
      tasks: [{ id: 't', name: 'T', nominalDays: 3, start: at(0), resourceId: 'stagista' }],
    };
    expect(costsOf(project).costs.get('t')).toEqual({
      amount: 0,
      costedDays: 3,
      uncostedDays: 0,
      dailyRates: [0],
    });
  });

  it('leaves a task untouched by a rate change starting the day after it closes', () => {
    const person: Person = { id: 'p', name: 'Priced', dailyRate: 100 };
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [person],
      tasks: [{ id: 't', name: 'T', nominalDays: 4, start: at(0), resourceId: 'p' }],
    };
    const before = costsOf(project);
    const end = before.solved.schedule.tasks.get('t')!.end;
    // The premise of the pin, measured rather than assumed: the task ends at the
    // closing time of its last working day, on the boundary the override opens at.
    expect(end.getHours()).toBe(17);
    const from = workingDaysAfter(before.solved.calendar, end, 1);
    const withRise: Project = {
      ...project,
      resources: [{ ...person, rateOverrides: [{ from, to: '2026-12-31', dailyRate: 9000 }] }],
    };
    expect(before.costs.get('t')).toEqual({
      amount: 400,
      costedDays: 4,
      uncostedDays: 0,
      dailyRates: [100],
    });
    expect(costsOf(withRise).costs.get('t')).toEqual(before.costs.get('t'));
  });

  it('costs only the days inside an override when no default is declared under it', () => {
    const person: Person = { id: 'luca', name: 'Luca' };
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [person],
      tasks: [{ id: 't', name: 'T', nominalDays: 4, start: at(0), resourceId: 'luca' }],
    };
    const { solved } = costsOf(project);
    const start = solved.schedule.tasks.get('t')!.start;
    const priced: Project = {
      ...project,
      resources: [
        {
          ...person,
          rateOverrides: [
            {
              from: dayStringOf(dayIndexOf(start)),
              to: workingDaysAfter(solved.calendar, start, 1),
              dailyRate: 250,
            },
          ],
        },
      ],
    };
    expect(costsOf(priced).costs.get('t')).toEqual({
      amount: 500,
      costedDays: 2,
      uncostedDays: 2,
      dailyRates: [250],
    });
    expectEffortConserved(priced);
  });

  describe('the roll-up', () => {
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [
        { id: 'marta', name: 'Marta', dailyRate: 500 },
        { id: 'luca', name: 'Luca' },
      ],
      tasks: [
        { id: 'sumA', name: 'A', nominalDays: 0, start: at(0) },
        {
          id: 'p1',
          name: 'P1',
          nominalDays: 2,
          start: at(0),
          resourceId: 'marta',
          parentId: 'sumA',
        },
        { id: 'p2', name: 'P2', nominalDays: 3, start: at(0), resourceId: 'luca', parentId: 'sumA' },
        { id: 'sumB', name: 'B', nominalDays: 0, start: at(0) },
        {
          id: 'q1',
          name: 'Q1',
          nominalDays: 2,
          start: at(0),
          resourceId: 'marta',
          parentId: 'sumB',
        },
        {
          id: 'q2',
          name: 'Q2',
          nominalDays: 4,
          start: at(0),
          resourceId: 'marta',
          parentId: 'sumB',
          disabled: true,
        },
        { id: 'sumC', name: 'C', nominalDays: 0, start: at(0) },
        {
          id: 'r1',
          name: 'R1',
          nominalDays: 1,
          start: at(0),
          resourceId: 'marta',
          parentId: 'sumC',
          disabled: true,
        },
        {
          id: 'r2',
          name: 'R2',
          nominalDays: 2,
          start: at(0),
          resourceId: 'marta',
          parentId: 'sumC',
          disabled: true,
        },
      ],
    };

    it('is partial exactly when a live leaf under it has no price', () => {
      const { costs } = costsOf(project);
      expect(costs.get('sumA')).toEqual({
        amount: 1000,
        costedDays: 2,
        uncostedDays: 3,
        dailyRates: [],
      });
      expect(costs.get('sumB')!.uncostedDays).toBe(0);
    });

    it('leaves a disabled leaf out of its parent while still pricing its own row', () => {
      const { costs } = costsOf(project);
      expect(costs.get('q2')).toEqual({
        amount: 2000,
        costedDays: 4,
        uncostedDays: 0,
        dailyRates: [500],
      });
      expect(costs.get('sumB')).toEqual({
        amount: 1000,
        costedDays: 2,
        uncostedDays: 0,
        dailyRates: [],
      });
    });

    it('rolls a summary with nothing enabled under it up from all of its children', () => {
      expect(costsOf(project).costs.get('sumC')).toEqual({
        amount: 1500,
        costedDays: 3,
        uncostedDays: 0,
        dailyRates: [],
      });
    });
  });

  it('prices fixture C exactly as the spec states it', () => {
    const marta: Person = { id: 'marta', name: 'Marta', dailyRate: 600 };
    const base: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [
        marta,
        { id: 'gino', name: 'Gino', availability: 0.5, dailyRate: 400 },
        { id: 'luca', name: 'Luca' },
      ],
      tasks: [
        { id: 'S1', name: 'S1', nominalDays: 0, start: at(0) },
        { id: 'T1', name: 'T1', nominalDays: 4, start: at(0), resourceId: 'marta', parentId: 'S1' },
        { id: 'T2', name: 'T2', nominalDays: 4, start: at(0), resourceId: 'gino', parentId: 'S1' },
        { id: 'S2', name: 'S2', nominalDays: 0, start: at(0), parentId: 'S1' },
        {
          id: 'T3',
          name: 'T3',
          nominalDays: 6,
          start: at(0),
          resourceId: 'marta',
          parentId: 'S2',
          predecessors: ['T1'],
        },
        { id: 'T4', name: 'T4', nominalDays: 3, start: at(0), resourceId: 'luca', parentId: 'S2' },
        { id: 'T5', name: 'T5', nominalDays: 2, start: at(0), parentId: 'S2' },
        {
          id: 'T6',
          name: 'T6',
          nominalDays: 5,
          start: at(0),
          resourceId: 'marta',
          parentId: 'S2',
          disabled: true,
        },
        { id: 'M1', name: 'M1', nominalDays: 0, start: at(0) },
      ],
    };
    // The override opens on T3's third working day as the engine placed it, not
    // as the spec's arithmetic reads it: a fixture restating that date would pin
    // a reading of the schedule instead of the schedule.
    const solvedBase = solve(base);
    const from = workingDaysAfter(
      solvedBase.calendar,
      solvedBase.schedule.tasks.get('T3')!.start,
      2,
    );
    const project: Project = {
      ...base,
      resources: [
        { ...marta, rateOverrides: [{ from, to: '2026-12-31', dailyRate: 650 }] },
        ...base.resources.slice(1),
      ],
    };

    const { costs } = costsOf(project);
    const table = Object.fromEntries(
      [...costs].map(([id, cost]) => [
        id,
        [cost.amount, cost.costedDays, cost.uncostedDays, cost.dailyRates],
      ]),
    );
    expect(table).toEqual({
      T1: [2400, 4, 0, [600]],
      T2: [1600, 4, 0, [400]],
      T3: [3800, 6, 0, [600, 650]],
      T4: [0, 0, 3, []],
      T5: [0, 0, 2, []],
      T6: [3000, 5, 0, [600]],
      M1: [0, 0, 0, []],
      S2: [3800, 6, 5, []],
      S1: [7800, 14, 5, []],
    });
    expectEffortConserved(project);
  });

  it('sorts the rates it applied, rather than reporting the order it met them', () => {
    // Every other fixture here raises the rate, so encounter order and ascending
    // order coincide and neither of the two would catch the other.
    const person: Person = { id: 'p', name: 'Priced', dailyRate: 700 };
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [person],
      tasks: [{ id: 't', name: 'T', nominalDays: 4, start: at(0), resourceId: 'p' }],
    };
    const { solved } = costsOf(project);
    const from = workingDaysAfter(solved.calendar, solved.schedule.tasks.get('t')!.start, 2);
    const withCut: Project = {
      ...project,
      resources: [{ ...person, rateOverrides: [{ from, to: '2026-12-31', dailyRate: 500 }] }],
    };
    expect(costsOf(withCut).costs.get('t')).toEqual({
      amount: 2400,
      costedDays: 4,
      uncostedDays: 0,
      dailyRates: [500, 700],
    });
  });

  it('leaves a disabled leaf whose resource no longer exists entirely uncosted', () => {
    // Reachable rather than defensive: a disabled leaf is handed to the engine
    // with no resource id at all (`project.ts:400`), so a dangling one cannot
    // stall the simulation the way it would on a live leaf.
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [],
      tasks: [
        {
          id: 't',
          name: 'T',
          nominalDays: 3,
          start: at(0),
          resourceId: 'ghost',
          disabled: true,
        },
      ],
    };
    expect(costsOf(project).costs.get('t')).toEqual({
      amount: 0,
      costedDays: 0,
      uncostedDays: 3,
      dailyRates: [],
    });
  });
});
