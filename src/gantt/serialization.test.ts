import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from '../scheduler';
import { validateCurrency, type RateOverride } from './cost';
import { buildPlan } from './plan';
import { emptyProject, sampleProject, solve, type Project } from './project';
import { validateResources } from './resources';
import {
  FILE_VERSION,
  ProjectFileError,
  deserializeProject,
  serializeForFile,
  serializeProject,
} from './serialization';

describe('round trip', () => {
  it('preserves the sample project', () => {
    const restored = deserializeProject(serializeProject(sampleProject));
    expect(restored.tasks).toEqual(sampleProject.tasks);
    expect(restored.resources).toEqual(sampleProject.resources);
    expect(restored.calendar).toEqual(sampleProject.calendar);
  });

  it('writes the solved schedule as a report beside the inputs', () => {
    const text = serializeProject(sampleProject, solve(sampleProject));
    const file = JSON.parse(text);
    expect(file.solved.projectStart).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(file.solved.projectEnd).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(file.solved.solvedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    for (const task of file.tasks) {
      expect(task.solved.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(task.solved.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(typeof task.solved.shared).toBe('boolean');
      expect(task.solved.cost === null || typeof task.solved.cost === 'number').toBe(true);
      expect(typeof task.solved.uncostedDays).toBe('number');
      expect(Array.isArray(task.solved.dailyRates)).toBe(true);
    }
    // A summary's report is the rollup the file's inputs cannot express.
    const summary = file.tasks.find((task: { id: string }) => task.id === '7');
    expect(summary.solved.effortDays).toBeCloseTo(3);
    // sampleProject names nobody a rate, so nothing is priced anywhere.
    expect(file.tasks.every((task: { solved: { cost: unknown } }) => task.solved.cost === null)).toBe(
      true,
    );
    expect(file.solved.totalCost).toBeNull();
    expect(file.solved.uncostedDays).toBeGreaterThan(0);
  });

  it('writes the file per-task cost and project totalCost from the same plan getPlan() reads', () => {
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      currency: 'EUR',
      resources: [{ id: 'r1', name: 'Marta', dailyRate: 600 }],
      tasks: [{ id: '1', name: 'A', nominalDays: 2, start: new Date(2026, 0, 5, 8, 0), resourceId: 'r1' }],
    };
    const solved = solve(project);
    const plan = buildPlan(solved);
    const text = serializeProject(project, solved);
    const file = JSON.parse(text);
    const task = file.tasks.find((entry: { id: string }) => entry.id === '1');
    const expected = plan.tasks.find((entry) => entry.id === '1')!;
    // Pinned as well as compared: a fixture that silently stopped being priced
    // would leave the comparison green on null === null.
    expect(expected.cost).toBe(1200);
    expect(task.solved.cost).toBe(expected.cost);
    expect(file.solved.totalCost).toBe(plan.totalCost);
    // The root key is the input; the report never repeats it.
    expect(file.currency).toBe('EUR');
    expect('currency' in file.solved).toBe(false);
  });

  it('ignores the report on load: the inputs alone decide the schedule', () => {
    const enriched = deserializeProject(serializeProject(sampleProject, solve(sampleProject)));
    const plain = deserializeProject(serializeProject(sampleProject));
    expect(enriched).toEqual(plain);
  });

  it('leaves the report out without a solve, for the history and the draft', () => {
    expect(serializeProject(sampleProject)).not.toContain('"solved"');
  });

  it('keeps the local wall-clock date, not the UTC instant', () => {
    // 08:00 local would roll back to the previous day if serialized as UTC.
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [],
      tasks: [{ id: '1', name: 'A', nominalDays: 1, start: new Date(2026, 0, 5, 8, 0) }],
    };
    const text = serializeProject(project);
    expect(text).toContain('2026-01-05T08:00');
    const restored = deserializeProject(text);
    expect(restored.tasks[0].start.getDate()).toBe(5);
    expect(restored.tasks[0].start.getHours()).toBe(8);
  });

  it('preserves partial staffing', () => {
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [
        { id: 'r1', name: 'Mezza giornata', availability: 0.5 },
        { id: 'r2', name: 'Pieno', availability: 1 },
      ],
      tasks: [{ id: '1', name: 'A', nominalDays: 2, start: new Date(2026, 0, 5, 8, 0), resourceId: 'r1' }],
    };
    const restored = deserializeProject(serializeProject(project));
    expect(restored.resources[0].availability).toBe(0.5);
    expect(restored.resources[1].availability).toBe(1);
  });

  it('preserves the hierarchy and the bar colour', () => {
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [{ id: 'r1', name: 'Alice' }],
      tasks: [
        { id: 'p', name: 'Parent', nominalDays: 0, start: new Date(2026, 0, 5, 8, 0) },
        {
          id: 'c',
          name: 'Child',
          nominalDays: 2,
          start: new Date(2026, 0, 5, 8, 0),
          parentId: 'p',
          resourceId: 'r1',
          color: '#2f9e6e',
        },
      ],
    };
    const restored = deserializeProject(serializeProject(project));
    expect(restored.tasks[1].parentId).toBe('p');
    expect(restored.tasks[1].color).toBe('#2f9e6e');
  });

  it('drops the resource a summary kept from before it had children', () => {
    // The engine ignores a summary's own resourceId, but a reader of the file
    // cannot tell the field is inert and takes it for an assignment.
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [
        { id: 'r1', name: 'Marta' },
        { id: 'r2', name: 'Gino' },
      ],
      tasks: [
        { id: 'group', name: 'Gruppo', nominalDays: 0, start: new Date(2026, 0, 5, 8, 0), resourceId: 'r1' },
        {
          id: 'work',
          name: 'Lavoro',
          nominalDays: 2,
          start: new Date(2026, 0, 5, 8, 0),
          parentId: 'group',
          resourceId: 'r2',
        },
      ],
    };
    const restored = deserializeProject(serializeProject(project));
    expect(restored.tasks[0].resourceId).toBeUndefined();
    expect(restored.tasks[1].resourceId).toBe('r2');
  });

  it('carries a disabled row, and writes the flag on nothing else', () => {
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [{ id: 'r1', name: 'Marta' }],
      tasks: [
        { id: 'p', name: 'Gruppo', nominalDays: 0, start: new Date(2026, 0, 5, 8, 0), disabled: true },
        {
          id: 'c',
          name: 'Segnaposto',
          nominalDays: 2,
          start: new Date(2026, 0, 5, 8, 0),
          parentId: 'p',
          resourceId: 'r1',
        },
      ],
    };
    const text = serializeProject(project);
    expect(text).toContain('"disabled":true');
    // Inherited down the tree, so the child's row says nothing of its own.
    expect(text.match(/"disabled"/g)).toHaveLength(1);
    const restored = deserializeProject(text);
    expect(restored.tasks[0].disabled).toBe(true);
    expect(restored.tasks[1].disabled).toBeUndefined();
  });

  it('reads a written false as no flag at all', () => {
    // Two spellings of the default would make the same project serialize two
    // ways, and the dirty comparison is a text comparison.
    const restored = deserializeProject(
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 2,
        tasks: [{ id: '1', nominalDays: 1, start: '2026-01-05T08:00', disabled: false }],
      }),
    );
    expect('disabled' in restored.tasks[0]).toBe(false);
    expect(serializeProject(restored)).not.toContain('disabled');
  });

  it('preserves company shutdowns and personal absences', () => {
    const project: Project = {
      calendar: {
        ...DEFAULT_CALENDAR,
        workingDays: [1, 2, 3, 4],
        holidays: [
          { from: '2026-12-24', to: '2027-01-06', label: 'Chiusura invernale' },
          { from: '2026-08-14', to: '2026-08-14' },
        ],
      },
      resources: [
        {
          id: 'r1',
          name: 'Marta',
          availability: 0.5,
          availabilityOverrides: [
            { from: '2026-07-01', to: '2026-07-15', availability: 0, label: 'Ferie' },
            { from: '2026-09-02', to: '2026-09-20', availability: 0.25 },
          ],
        },
        { id: 'r2', name: 'Ugo' },
      ],
      tasks: [
        { id: '1', name: 'A', nominalDays: 2, start: new Date(2026, 5, 1, 8, 0), resourceId: 'r1' },
      ],
    };
    const restored = deserializeProject(serializeProject(project));
    expect(restored.calendar.holidays).toEqual(project.calendar.holidays);
    expect(restored.calendar.workingDays).toEqual([1, 2, 3, 4]);
    expect(restored.resources[0].availabilityOverrides).toEqual(
      project.resources[0].availabilityOverrides,
    );
    // A resource with no periods must not gain an empty array.
    expect(restored.resources[1].availabilityOverrides).toBeUndefined();
  });

  it('survives a DST boundary', () => {
    // Italy moves the clock on the last Sunday of March.
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      resources: [],
      tasks: [{ id: '1', name: 'A', nominalDays: 1, start: new Date(2026, 2, 29, 8, 0) }],
    };
    const restored = deserializeProject(serializeProject(project));
    expect(restored.tasks[0].start.getDate()).toBe(29);
    expect(restored.tasks[0].start.getHours()).toBe(8);
  });
});

describe('the file the app writes, the app can reopen', () => {
  const poisoned = (): Project => ({
    calendar: DEFAULT_CALENDAR,
    resources: [{ id: 'r1', name: 'Marta' }],
    tasks: [
      { id: '1', name: 'A', nominalDays: 2, start: new Date(2026, 0, 5, 8, 0), resourceId: 'r1' },
      { id: '2', name: 'B', nominalDays: 2, start: new Date(2026, 0, 5, 8, 0), resourceId: 'ghost' },
    ],
  });

  it('hands a sound project back unrefused, report included', () => {
    // What "ignores the report on load" above cannot say, since it never goes
    // through the guard: that the guard lets a sound project past, and returns
    // the text it checked rather than a report-less copy of what it parsed.
    const text = serializeForFile(sampleProject, solve(sampleProject));
    expect(text).toContain('"solved"');
    const restored = deserializeProject(text);
    expect(restored.tasks).toEqual(deserializeProject(serializeProject(sampleProject)).tasks);
  });

  it('refuses a project naming somebody the file could not name back', () => {
    expect(() => serializeForFile(poisoned())).toThrow(ProjectFileError);
    // The parser's own message, unchanged: it says which task and which id.
    expect(() => serializeForFile(poisoned())).toThrow(/tasks\[1\].*unknown resource "ghost"/);
  });

  it('leaves serializeProject alone, or undo and the draft would die with it', () => {
    const text = serializeProject(poisoned());
    expect(text).toContain('"ghost"');
    expect(text).not.toContain('"solved"');
  });
});

describe('rejects broken files', () => {
  const cases: [string, string][] = [
    ['not json', 'nope{'],
    ['a foreign format', JSON.stringify({ format: 'something-else', version: 1 })],
    [
      'a future version',
      JSON.stringify({ format: 'gantt-effort-split', version: FILE_VERSION + 1 }),
    ],
    [
      'a malformed date',
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 1,
        tasks: [{ id: '1', nominalDays: 1, start: '05/01/2026' }],
      }),
    ],
    [
      'a colour that is not a hex triplet',
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 1,
        tasks: [{ id: '1', nominalDays: 1, start: '2026-01-05T08:00', color: 'red' }],
      }),
    ],
    [
      'a shorthand colour',
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 1,
        tasks: [{ id: '1', nominalDays: 1, start: '2026-01-05T08:00', color: '#f00' }],
      }),
    ],
    [
      'a duplicate task id',
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 1,
        tasks: [
          { id: '1', nominalDays: 1, start: '2026-01-05T08:00' },
          { id: '1', nominalDays: 1, start: '2026-01-06T08:00' },
        ],
      }),
    ],
    [
      'a task assigned to an unknown resource',
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 1,
        resources: [],
        tasks: [{ id: '1', nominalDays: 1, start: '2026-01-05T08:00', resourceId: 'ghost' }],
      }),
    ],
    [
      'a parent that does not exist',
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 1,
        tasks: [{ id: '1', nominalDays: 1, start: '2026-01-05T08:00', parentId: 'ghost' }],
      }),
    ],
    [
      'a circular hierarchy',
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 1,
        tasks: [
          { id: '1', nominalDays: 1, start: '2026-01-05T08:00', parentId: '2' },
          { id: '2', nominalDays: 1, start: '2026-01-05T08:00', parentId: '1' },
        ],
      }),
    ],
    [
      'a malformed holiday date',
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 1,
        calendar: { workingDays: [1], windows: [{ from: 480, to: 960 }], holidays: [{ from: '24/12/2026', to: '2026-12-24' }] },
        tasks: [],
      }),
    ],
    [
      'an absence that is not a day range',
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 1,
        resources: [{ id: 'r1', name: 'X', daysOff: [{ from: '2026-07-01' }] }],
        tasks: [],
      }),
    ],
    [
      'an availability share outside 0..1',
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 2,
        resources: [
          {
            id: 'r1',
            name: 'X',
            availabilityOverrides: [{ from: '2026-09-02', to: '2026-09-20', availability: 25 }],
          },
        ],
        tasks: [],
      }),
    ],
    [
      'a default availability of zero',
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 2,
        resources: [{ id: 'r1', name: 'X', availability: 0 }],
        tasks: [{ id: '1', nominalDays: 1, start: '2026-01-05T08:00', resourceId: 'r1' }],
      }),
    ],
    [
      'a default availability above 1',
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 2,
        resources: [{ id: 'r1', name: 'X', availability: 1.5 }],
        tasks: [],
      }),
    ],
    [
      'two people with the same name',
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 2,
        resources: [
          { id: 'r1', name: 'Marta', availability: 1 },
          { id: 'r2', name: 'Marta', availability: 1 },
        ],
        tasks: [],
      }),
    ],
    [
      'a disabled flag that is not a boolean',
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 2,
        tasks: [{ id: '1', nominalDays: 1, start: '2026-01-05T08:00', disabled: 'yes' }],
      }),
    ],
    [
      'a dangling predecessor',
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 1,
        tasks: [{ id: '1', nominalDays: 1, start: '2026-01-05T08:00', predecessors: ['99'] }],
      }),
    ],
  ];

  for (const [label, text] of cases) {
    it(`rejects ${label}`, () => {
      expect(() => deserializeProject(text)).toThrow(ProjectFileError);
    });
  }

  it('reads version 1 absences as overrides at zero', () => {
    const project = deserializeProject(
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 1,
        resources: [
          { id: 'r1', name: 'Marta', daysOff: [{ from: '2026-07-01', to: '2026-07-15' }] },
        ],
        tasks: [],
      }),
    );
    expect(project.resources[0].availabilityOverrides).toEqual([
      { from: '2026-07-01', to: '2026-07-15', availability: 0 },
    ]);
  });

  it('accepts a file with no tasks', () => {
    const project = deserializeProject(
      JSON.stringify({ format: 'gantt-effort-split', version: 1 }),
    );
    expect(project.tasks).toEqual([]);
    expect(project.calendar).toEqual(DEFAULT_CALENDAR);
  });
});

describe('rates and currency (F1)', () => {
  // Pinned from the build at 1bb6cbe, before rates/currency existed: printed
  // by a scratch test against `serializeProject(emptyProject())`, copied here,
  // then deleted. A project that never enters either field must keep writing
  // exactly this text.
  const EMPTY_PROJECT_TEXT =
    '{"format":"gantt-effort-split","version":2,"calendar":{"workingDays":[1,2,3,4,5],' +
    '"windows":[{"from":480,"to":720},{"from":780,"to":1020}]},"resources":[],"tasks":[]}';

  it('serializes an empty project byte-identically to the pre-F1 build', () => {
    expect(serializeProject(emptyProject())).toBe(EMPTY_PROJECT_TEXT);
  });

  it('parses a v2 text with neither rate nor currency fields as the pre-F1 build did, and re-serializes it identically', () => {
    // Pinned the same way: the fixture below, run through the build at
    // 1bb6cbe, produced this exact re-serialization.
    const text = JSON.stringify({
      format: 'gantt-effort-split',
      version: 2,
      calendar: DEFAULT_CALENDAR,
      resources: [
        { id: 'r1', name: 'Marta', availability: 0.5 },
        { id: 'r2', name: 'Gino' },
      ],
      tasks: [{ id: '1', name: 'A', nominalDays: 2, start: '2026-01-05T08:00', resourceId: 'r1' }],
    });
    const project = deserializeProject(text);
    expect(project).toEqual({
      calendar: DEFAULT_CALENDAR,
      resources: [
        { id: 'r1', name: 'Marta', availability: 0.5 },
        { id: 'r2', name: 'Gino' },
      ],
      tasks: [
        {
          id: '1',
          name: 'A',
          nominalDays: 2,
          start: new Date(2026, 0, 5, 8, 0),
          resourceId: 'r1',
        },
      ],
    });
    expect('currency' in project).toBe(false);
    expect(serializeProject(project)).toBe(
      '{"format":"gantt-effort-split","version":2,"calendar":{"workingDays":[1,2,3,4,5],' +
        '"windows":[{"from":480,"to":720},{"from":780,"to":1020}]},"resources":[{"id":"r1",' +
        '"name":"Marta","availability":0.5},{"id":"r2","name":"Gino"}],"tasks":[{"id":"1",' +
        '"name":"A","nominalDays":2,"start":"2026-01-05T08:00","resourceId":"r1"}]}',
    );
  });

  it('round-trips rates, a person with only overrides, a zero rate and a currency through the file gate', () => {
    const project: Project = {
      calendar: DEFAULT_CALENDAR,
      currency: 'EUR',
      resources: [
        {
          id: 'r1',
          name: 'Marta',
          availability: 1,
          dailyRate: 600,
          rateOverrides: [{ from: '2026-09-08', to: '2026-09-09', dailyRate: 650, label: 'Senior' }],
        },
        { id: 'r2', name: 'Gino Gratis', dailyRate: 0 },
        {
          id: 'r3',
          name: 'Solo periodi',
          rateOverrides: [{ from: '2026-09-08', to: '2026-09-09', dailyRate: 400 }],
        },
      ],
      tasks: [{ id: '1', name: 'A', nominalDays: 2, start: new Date(2026, 0, 5, 8, 0), resourceId: 'r1' }],
    };
    const text = serializeForFile(project);
    const restored = deserializeProject(text);
    expect(restored).toEqual(project);
    expect(text).not.toContain('"dailyRate":null');
    expect(text).not.toContain('"rateOverrides":[]');
    expect(text).not.toContain('"currency":null');
  });

  it('omits the currency key entirely when the project never held one', () => {
    const project: Project = { calendar: DEFAULT_CALENDAR, resources: [], tasks: [] };
    expect(serializeProject(project)).not.toContain('currency');
  });

  describe('the refusal table', () => {
    const withResource = (resource: Record<string, unknown>) =>
      JSON.stringify({
        format: 'gantt-effort-split',
        version: 2,
        resources: [{ id: 'r1', name: 'X', ...resource }],
        tasks: [],
      });
    const withCurrency = (currency: unknown) =>
      JSON.stringify({ format: 'gantt-effort-split', version: 2, currency, tasks: [] });

    it('refuses a negative dailyRate', () => {
      expect(() => deserializeProject(withResource({ dailyRate: -1 }))).toThrow(ProjectFileError);
    });

    it('refuses a string dailyRate', () => {
      expect(() => deserializeProject(withResource({ dailyRate: '600' }))).toThrow(
        ProjectFileError,
      );
    });

    it('refuses a rate override without a dailyRate', () => {
      expect(() =>
        deserializeProject(
          withResource({ rateOverrides: [{ from: '2026-09-08', to: '2026-09-09' }] }),
        ),
      ).toThrow(ProjectFileError);
    });

    it('refuses a rate override with a malformed day', () => {
      expect(() =>
        deserializeProject(
          withResource({
            rateOverrides: [{ from: '08/09/2026', to: '2026-09-09', dailyRate: 600 }],
          }),
        ),
      ).toThrow(ProjectFileError);
    });

    it('refuses an empty currency', () => {
      expect(() => deserializeProject(withCurrency(''))).toThrow(ProjectFileError);
    });

    it('refuses a padded currency', () => {
      expect(() => deserializeProject(withCurrency('  '))).toThrow(ProjectFileError);
    });

    it('refuses a non-string currency', () => {
      expect(() => deserializeProject(withCurrency(5))).toThrow(ProjectFileError);
    });

    it('refuses a 9-character currency', () => {
      expect(() => deserializeProject(withCurrency('123456789'))).toThrow(ProjectFileError);
    });

    it('shares one message between the parser, the dialog and the agent API for the rate cases', () => {
      const negative = [{ id: 'r1', name: 'X', dailyRate: -1 }];
      expect(validateResources(negative)).toBe(
        'Invalid daily rate for "X": expected a number of 0 or more',
      );
      expect(() => deserializeProject(withResource({ dailyRate: -1 }))).toThrow(
        /Invalid daily rate for "X": expected a number of 0 or more/,
      );

      const badOverride = [
        {
          id: 'r1',
          name: 'X',
          rateOverrides: [
            { from: '2026-09-08', to: '2026-09-09' } as unknown as RateOverride,
          ],
        },
      ];
      expect(validateResources(badOverride)).toBe(
        'A rate period of "X" needs a numeric "dailyRate"',
      );
    });

    it('shares one message between the parser and the agent API for the currency cases', () => {
      // A blank string is refused by `requireString` before `validateCurrency`
      // ever runs — the same structural check every other string field in the
      // file shares (id, name, ...) — so the message-sharing guarantee holds
      // for `validateCurrency`'s own rules: padding and length.
      expect(validateCurrency('  ')).toBe('Currency: a short label of up to 8 characters');
      expect(validateCurrency('123456789')).toBe('Currency: a short label of up to 8 characters');
      try {
        deserializeProject(withCurrency('  '));
        expect.unreachable();
      } catch (error) {
        expect((error as Error).message).toBe('Currency: a short label of up to 8 characters');
      }
      try {
        deserializeProject(withCurrency('123456789'));
        expect.unreachable();
      } catch (error) {
        expect((error as Error).message).toBe('Currency: a short label of up to 8 characters');
      }
    });
  });
});
