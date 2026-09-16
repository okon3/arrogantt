import { describe, expect, it } from 'vitest';
import type { Resource } from '../scheduler';
import type { Person } from './cost';
import { buildPlan } from './plan';
import { planToCsv } from './planCsv';
import { solve, type Project } from './project';

const people: Resource[] = [
  { id: 'r1', name: 'Marta Rossi', availability: 1 },
  { id: 'r2', name: 'Gino; Bianchi', availability: 0.5 },
];

function csvOf(project: Project): string[] {
  return planToCsv(buildPlan(solve(project)), project.resources).split('\r\n');
}

/**
 * Splits on the separators outside quotes, so a field carrying one still counts
 * as a single column — the naive `split(';')` shifts every column after it and
 * turns a passing assertion into a puzzle.
 *
 * Quotes are kept: what they wrap is this file's own escaping, which is the
 * thing under test rather than something to undo before looking at it.
 */
function columns(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (const character of line) {
    if (character === '"') quoted = !quoted;
    if (character === ';' && !quoted) {
      fields.push(field);
      field = '';
      continue;
    }
    field += character;
  }
  fields.push(field);
  return fields;
}

function at(project: Project, name: string): string[] {
  const line = csvOf(project).find((row) => row.includes(name));
  if (!line) throw new Error(`no row for ${name}`);
  return columns(line);
}

describe('planToCsv', () => {
  const project: Project = {
    calendar: { workingDays: [1, 2, 3, 4, 5], windows: [{ from: 480, to: 720 }, { from: 780, to: 1020 }] },
    resources: people,
    tasks: [
      { id: '1', name: 'Analisi', nominalDays: 5, start: new Date(2026, 8, 7, 8, 0), resourceId: 'r1' },
      { id: '2', name: 'Sviluppo', nominalDays: 2.5, start: new Date(2026, 8, 7, 8, 0), resourceId: 'r2' },
    ],
  };

  it('opens with a BOM so a spreadsheet reads the accents', () => {
    expect(planToCsv(buildPlan(solve(project)), people).charCodeAt(0)).toBe(0xfeff);
  });

  it('heads the columns and ends every line, the last one included', () => {
    const text = planToCsv(buildPlan(solve(project)), people);
    expect(text.slice(1).split('\r\n')[0]).toBe(
      'Id;Task;Level;Summary;Person;Start;End;Effort (d);Duration (d);Contended;Predecessors;Disabled;Cost;Uncosted (d)',
    );
    expect(text.endsWith('\r\n')).toBe(true);
  });

  it('carries the currency label in the Cost header, never in a cell', () => {
    const priced: Project = { ...project, currency: 'EUR' };
    const text = planToCsv(buildPlan(solve(priced)), people);
    expect(text.slice(1).split('\r\n')[0]).toBe(
      'Id;Task;Level;Summary;Person;Start;End;Effort (d);Duration (d);Contended;Predecessors;Disabled;Cost (EUR);Uncosted (d)',
    );
  });

  it('writes the dates the schedule carries, day first', () => {
    const [, name, , , person, start, end] = at(project, 'Analisi');
    expect(name).toBe('Analisi');
    expect(person).toBe('Marta Rossi');
    expect(start).toBe('07/09/2026 08:00');
    expect(end).toBe('11/09/2026 17:00');
  });

  it('separates the decimals with a comma', () => {
    const columns = at(project, 'Sviluppo');
    expect(columns[7]).toBe('2,5');
    // Half rate doubles the elapsed span without touching the effort.
    expect(columns[8]).toBe('5');
  });

  it('quotes a field carrying the separator', () => {
    expect(at(project, 'Sviluppo')[4]).toBe('"Gino; Bianchi"');
  });

  it('quotes and doubles a quote inside a name', () => {
    const quoted: Project = {
      ...project,
      tasks: [
        { id: '1', name: 'Fase "uno"', nominalDays: 1, start: new Date(2026, 8, 7, 8, 0) },
      ],
    };
    expect(at(quoted, 'Fase')[1]).toBe('"Fase ""uno"""');
  });

  it('marks a summary, whose effort is a rollup rather than a figure to sum', () => {
    const nested: Project = {
      ...project,
      tasks: [
        { id: 'p', name: 'Progetto', nominalDays: 0, start: new Date(2026, 8, 7, 8, 0) },
        {
          id: 'c',
          name: 'Foglia',
          nominalDays: 3,
          start: new Date(2026, 8, 7, 8, 0),
          resourceId: 'r1',
          parentId: 'p',
        },
      ],
    };
    const parent = at(nested, 'Progetto');
    expect(parent[2]).toBe('1');
    expect(parent[3]).toBe('yes');
    expect(parent[7]).toBe('3');
    // A summary belongs to nobody: the people are on the leaves that consume time.
    expect(parent[4]).toBe('');
    const child = at(nested, 'Foglia');
    expect(child[2]).toBe('2');
    expect(child[3]).toBe('');
  });

  it('flags the row a shared resource stretched', () => {
    const contended: Project = {
      ...project,
      tasks: [
        { id: '1', name: 'Prima', nominalDays: 2, start: new Date(2026, 8, 7, 8, 0), resourceId: 'r1' },
        { id: '2', name: 'Seconda', nominalDays: 2, start: new Date(2026, 8, 7, 8, 0), resourceId: 'r1' },
      ],
    };
    expect(at(contended, 'Prima')[9]).toBe('yes');
    expect(at(project, 'Analisi')[9]).toBe('');
  });

  it('lists the predecessors by id, which is the column that identifies a row', () => {
    const chained: Project = {
      ...project,
      tasks: [
        { id: '1', name: 'Prima', nominalDays: 1, start: new Date(2026, 8, 7, 8, 0) },
        {
          id: '2',
          name: 'Seconda',
          nominalDays: 1,
          start: new Date(2026, 8, 7, 8, 0),
          predecessors: ['1'],
        },
      ],
    };
    expect(at(chained, 'Seconda')[10]).toBe('1');
  });

  it('keeps a milestone on the single instant the schedule pinned it to', () => {
    const milestone: Project = {
      ...project,
      tasks: [
        { id: '1', name: 'Analisi', nominalDays: 5, start: new Date(2026, 8, 7, 8, 0), resourceId: 'r1' },
        {
          id: '2',
          name: 'Consegna',
          nominalDays: 0,
          start: new Date(2026, 8, 7, 8, 0),
          predecessors: ['1'],
        },
      ],
    };
    const [, , , , , start, end] = at(milestone, 'Consegna');
    expect(start).toBe(end);
    // The instant Analisi closes on, seen from the same side the diamond is drawn.
    expect(start).toBe('11/09/2026 17:00');
  });

  it('marks a placeholder, so an export cannot read it as committed work', () => {
    const withPlaceholder: Project = {
      ...project,
      tasks: [
        { id: '1', name: 'Analisi', nominalDays: 5, start: new Date(2026, 8, 7, 8, 0), resourceId: 'r1' },
        {
          id: '2',
          name: 'Ipotesi',
          nominalDays: 3,
          start: new Date(2026, 8, 7, 8, 0),
          resourceId: 'r1',
          disabled: true,
        },
      ],
    };
    expect(at(withPlaceholder, 'Ipotesi')[11]).toBe('yes');
    expect(at(withPlaceholder, 'Analisi')[11]).toBe('');
  });

  it('holds a header and nothing else for an empty plan', () => {
    const empty = planToCsv(buildPlan(solve({ ...project, tasks: [] })), people);
    expect(empty.slice(1).split('\r\n').filter((line) => line.length > 0)).toHaveLength(1);
  });
});

describe('planToCsv cost columns', () => {
  const pricedPeople: Person[] = [
    { id: 'marta', name: 'Marta', availability: 1, dailyRate: 600 },
    { id: 'luca', name: 'Luca', availability: 1 },
  ];

  const base: Project = {
    calendar: { workingDays: [1, 2, 3, 4, 5], windows: [{ from: 480, to: 720 }, { from: 780, to: 1020 }] },
    resources: pricedPeople,
    tasks: [],
  };

  it('writes a costed leaf with a decimal comma and no grouping', () => {
    const project: Project = {
      ...base,
      resources: [{ id: 'marta', name: 'Marta', availability: 1, dailyRate: 610 }],
      tasks: [
        {
          id: '1',
          name: 'Analisi',
          nominalDays: 2.25,
          start: new Date(2026, 8, 7, 8, 0),
          resourceId: 'marta',
        },
      ],
    };
    const row = at(project, 'Analisi');
    // Over 1000 (exposes grouping, which must not appear) and fractional
    // (the effort is entered in quarters of a day): 610 * 2.25 = 1372.5.
    expect(row[12]).toBe('1372,5');
    expect(row[13]).toBe('0');
  });

  it('sums a partial summary as a lower bound and reports the unpriced days, both bare numbers', () => {
    const project: Project = {
      ...base,
      tasks: [
        { id: 'p', name: 'Gruppo', nominalDays: 0, start: new Date(2026, 8, 7, 8, 0) },
        {
          id: 'c1',
          name: 'Costata',
          nominalDays: 2,
          start: new Date(2026, 8, 7, 8, 0),
          resourceId: 'marta',
          parentId: 'p',
        },
        {
          id: 'c2',
          name: 'Non costata',
          nominalDays: 3,
          start: new Date(2026, 8, 7, 8, 0),
          resourceId: 'luca',
          parentId: 'p',
        },
      ],
    };
    // 2 d at 600, priced in full.
    expect(at(project, 'Costata')[12]).toBe('1200');
    expect(at(project, 'Costata')[13]).toBe('0');
    // Luca carries no rate: nothing to price, all 3 days left out.
    expect(at(project, 'Non costata')[12]).toBe('');
    expect(at(project, 'Non costata')[13]).toBe('3');
    // The summary sums only what was priced; the uncosted days say by how much.
    const summary = at(project, 'Gruppo');
    expect(summary[12]).toBe('1200');
    expect(summary[13]).toBe('3');
  });

  it('leaves the cost cell empty when nothing priced the row, uncosted days included', () => {
    const project: Project = {
      ...base,
      tasks: [
        { id: '1', name: 'Senza risorsa', nominalDays: 2, start: new Date(2026, 8, 7, 8, 0) },
      ],
    };
    const row = at(project, 'Senza risorsa');
    expect(row[12]).toBe('');
    expect(row[13]).toBe('2');
  });

  it('writes 0 for a rate declared at zero, which is priced and not absent', () => {
    const project: Project = {
      ...base,
      resources: [{ id: 'stagista', name: 'Stagista', availability: 1, dailyRate: 0 }],
      tasks: [
        {
          id: '1',
          name: 'Affiancamento',
          nominalDays: 5,
          start: new Date(2026, 8, 7, 8, 0),
          resourceId: 'stagista',
        },
      ],
    };
    const row = at(project, 'Affiancamento');
    expect(row[12]).toBe('0');
    expect(row[13]).toBe('0');
  });

  it('costs a milestone at zero, having no effort to leave uncosted', () => {
    const project: Project = {
      ...base,
      tasks: [
        { id: '1', name: 'Traguardo', nominalDays: 0, start: new Date(2026, 8, 7, 8, 0) },
      ],
    };
    const row = at(project, 'Traguardo');
    expect(row[12]).toBe('0');
    expect(row[13]).toBe('0');
  });
});
