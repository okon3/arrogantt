import { describe, expect, it } from 'vitest';
import type { Resource } from '../scheduler';
import { PLAN_COLUMNS } from './columns';
import { parseWallClock, serializeDate } from './dates';
import { planFigure, planFigurePages, tickUnit } from './planFigure';
import { buildPlan } from './plan';
import { solve, type Project } from './project';

const people: Resource[] = [
  { id: 'r1', name: 'Marta Rossi', availability: 1 },
  { id: 'r2', name: 'Gino Bianchi', availability: 0.5 },
];

const calendar = {
  workingDays: [1, 2, 3, 4, 5],
  windows: [
    { from: 480, to: 720 },
    { from: 780, to: 1020 },
  ],
};

function figureOf(tasks: Project['tasks'], options?: Parameters<typeof planFigure>[2]) {
  const project: Project = { calendar, resources: people, tasks };
  return planFigure(project, solve(project), options);
}

const monday = new Date(2026, 8, 7, 8, 0);

/** The attributes of the one `<rect>`, `<polygon>` or `<text>` a matcher picks out. */
function attributes(svg: string, pattern: RegExp): Record<string, string> {
  const match = pattern.exec(svg);
  if (!match) throw new Error(`nothing matched ${pattern}`);
  const found: Record<string, string> = {};
  for (const [, name, value] of match[0].matchAll(/([a-z-]+)="([^"]*)"/g)) found[name] = value;
  return found;
}

// Captured on the unedited `planFigure.ts`, before F8's `columns` option
// existed — the byte-identical proof that the legacy path (no `columns`)
// still draws the same SVG once the option is added.
const PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="166" viewBox="0 0 1050 166" font-family="system-ui, sans-serif"><rect width="1050" height="166" fill="#fff" /><text x="16" y="30" font-size="14" font-weight="600" fill="#1f2430">pin.gantt</text><text x="1034" y="30" font-size="11" fill="#6b7280" text-anchor="end">07/09/2026 → 08/09/2026</text><text x="380" y="55" font-size="11" fill="#6b7280">Sep 2026</text><line x1="16" y1="60" x2="1034" y2="60" stroke="#dfe2e8" /><text x="379" y="73" font-size="10" fill="#99a0ab">7</text><text x="708" y="73" font-size="10" fill="#99a0ab">8</text><line x1="16" y1="78" x2="1034" y2="78" stroke="#edeef1" /><text x="16" y="94" font-size="12" font-weight="600" fill="#1f2430">Fase</text><rect x="485.67" y="86" width="452.38" height="8" rx="4" fill="#55637a" /><line x1="16" y1="102" x2="1034" y2="102" stroke="#edeef1" /><text x="28" y="118" font-size="12" fill="#1f2430">Analisi</text><text x="266" y="118" font-size="11" fill="#6b7280">Marta Rossi</text><rect x="485.67" y="108" width="452.38" height="12" rx="6" fill="#3b74d6" /><line x1="16" y1="126" x2="1034" y2="126" stroke="#edeef1" /><text x="16" y="142" font-size="12" fill="#1f2430">Consegna</text><polygon points="938.04,132.5 943.54,138 938.04,143.5 932.54,138" fill="#3b74d6" /><line x1="16" y1="150" x2="1034" y2="150" stroke="#edeef1" /><line x1="376" y1="42" x2="376" y2="150" stroke="#dfe2e8" /></svg>';

describe('planFigure', () => {
  it('with no columns draws the legacy Name + Person outline, byte-identical to the pre-F8 build', () => {
    const { svg } = figureOf(
      [
        { id: 'p', name: 'Fase', nominalDays: 0, start: monday },
        { id: 'c', name: 'Analisi', nominalDays: 2, start: monday, resourceId: 'r1', parentId: 'p' },
        { id: 'm', name: 'Consegna', nominalDays: 0, start: monday, predecessors: ['c'] },
      ],
      { width: 1050, title: 'pin.gantt' },
    );
    expect(svg).toBe(PIN_SVG);
  });

  it('is one self-contained SVG: no stylesheet, no variable, no external reference', () => {
    const { svg } = figureOf([
      { id: '1', name: 'Analisi', nominalDays: 5, start: monday, resourceId: 'r1' },
    ]);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).not.toContain('var(--');
    expect(svg).not.toContain('<style');
    expect(svg).not.toContain('href');
  });

  it('grows with the plan rather than with a viewport', () => {
    const one = figureOf([{ id: '1', name: 'A', nominalDays: 1, start: monday }]);
    const many = figureOf(
      Array.from({ length: 40 }, (_, index) => ({
        id: String(index),
        name: `A${index}`,
        nominalDays: 1,
        start: monday,
      })),
    );
    expect(many.height - one.height).toBe(39 * 24);
    expect(many.width).toBe(one.width);
  });

  it('spans the timeline over the plan, closing day included', () => {
    // Monday to Friday at full rate: five day columns, so a fifth of the
    // timeline each.
    const { svg, width } = figureOf([
      { id: '1', name: 'Analisi', nominalDays: 5, start: monday, resourceId: 'r1' },
    ]);
    const bar = attributes(svg, /<rect x="[^"]+" y="[^"]+" width="[^"]+" height="12"[^/]*\/>/);
    const timelineLeft = 16 + 250 + 110;
    const pxPerDay = (width - 16 - timelineLeft) / 5;
    // 08:00 is a third of the way into the first column, 17:00 seven tenths into
    // the last: the same offsets the chart draws the bar between.
    expect(Number(bar.x)).toBeCloseTo(timelineLeft + pxPerDay * (8 / 24), 1);
    expect(Number(bar.x) + Number(bar.width)).toBeCloseTo(timelineLeft + pxPerDay * (4 + 17 / 24), 1);
  });

  it('draws a milestone as a diamond on the instant the schedule pinned it to', () => {
    const { svg, width } = figureOf([
      { id: '1', name: 'Analisi', nominalDays: 5, start: monday, resourceId: 'r1' },
      { id: '2', name: 'Consegna', nominalDays: 0, start: monday, predecessors: ['1'] },
    ]);
    const diamond = attributes(svg, /<polygon points="[^"]+" fill="[^"]+" \/>/);
    const timelineLeft = 16 + 250 + 110;
    const pxPerDay = (width - 16 - timelineLeft) / 5;
    // Friday 17:00, which is where Analisi closes and where the chart's diamond
    // sits — not Monday morning, the start constraint it was given.
    const expected = timelineLeft + pxPerDay * (4 + 17 / 24);
    const xs = diamond.points.split(' ').map((point) => Number(point.split(',')[0]));
    expect(Math.min(...xs)).toBeCloseTo(expected - 5.5, 1);
    expect(Math.max(...xs)).toBeCloseTo(expected + 5.5, 1);
  });

  it('draws a summary flatter than a leaf, and never as a milestone', () => {
    const { svg } = figureOf([
      { id: 'p', name: 'Fase', nominalDays: 0, start: monday },
      { id: 'm', name: 'Consegna', nominalDays: 0, start: monday, parentId: 'p' },
    ]);
    // The parent of a lone milestone has zero effort and start === end, and is
    // still a bracket over the row rather than a second diamond.
    expect(svg.match(/<polygon/g)).toHaveLength(1);
    expect(svg).toContain('height="8"');
  });

  it('carries the task colour, darkened on the summary above it', () => {
    const { svg } = figureOf([
      { id: 'p', name: 'Fase', nominalDays: 0, start: monday, color: '#2f9e6e' },
      { id: 'c', name: 'Foglia', nominalDays: 2, start: monday, resourceId: 'r1', parentId: 'p' },
    ]);
    // The leaf inherits its top-level ancestor's colour, as the chart's bars do.
    expect(svg).toContain('height="12" rx="6" fill="#2f9e6e"');
    expect(svg).toContain('height="8" rx="4" fill="#1a573d"');
  });

  it('shades the days nobody works, weekends and shutdowns alike', () => {
    const spanning = figureOf([
      { id: '1', name: 'Analisi', nominalDays: 8, start: monday, resourceId: 'r1' },
    ]);
    // Two weekend days inside the span, plus none outside it.
    expect(spanning.svg.match(/fill="#f5f6f9"/g)).toHaveLength(2);
  });

  it('prints the names, the people and the title, escaped', () => {
    const { svg } = figureOf(
      [{ id: '1', name: 'A & B <c>', nominalDays: 1, start: monday, resourceId: 'r2' }],
      { title: 'piano "2026".gantt' },
    );
    expect(svg).toContain('A &amp; B &lt;c&gt;');
    expect(svg).toContain('Gino Bianchi');
    expect(svg).toContain('piano &quot;2026&quot;.gantt');
    // Gino works half days, so one day of effort spans two of them.
    expect(svg).toContain('07/09/2026 → 08/09/2026');
  });

  it('truncates a name rather than letting it run into the timeline', () => {
    const { svg } = figureOf([
      { id: '1', name: 'A'.repeat(120), nominalDays: 1, start: monday },
    ]);
    expect(svg).toContain('…');
    expect(svg).not.toContain('A'.repeat(60));
  });

  it('draws today only when the plan covers it', () => {
    const inside = figureOf([{ id: '1', name: 'A', nominalDays: 5, start: monday }], {
      today: new Date(2026, 8, 9, 12, 0),
    });
    const outside = figureOf([{ id: '1', name: 'A', nominalDays: 5, start: monday }], {
      today: new Date(2026, 0, 9, 12, 0),
    });
    expect(inside.svg).toContain('#3b6fe0');
    expect(outside.svg).not.toContain('#3b6fe0');
  });

  it('holds a frame and a title for an empty plan instead of throwing', () => {
    const { svg } = figureOf([], { title: 'vuoto.gantt' });
    expect(svg).toContain('no tasks');
    expect(svg).not.toContain('<rect x=');
  });
});

/**
 * Fixture C (spec §8, hub-corrected 2026-09-16): `S1 { T1, T2, S2 { T3, T4,
 * T5, T6 } }`, `M1` a top-level sibling of `S1`. Marta's raise starts on the
 * third working day of T3, computed from a first solve, so T3 straddles it
 * (2 d at 600 + 4 d at 650 = 3800) — the same two-pass build the spec's
 * `arrogantt` script does through `getCalendar()`/`getPlan()`.
 */
const fixtureCCalendar = {
  workingDays: [1, 2, 3, 4, 5],
  windows: [
    { from: 480, to: 720 },
    { from: 780, to: 1020 },
  ],
};

function fixtureCTasks(): Project['tasks'] {
  return [
    { id: 's1', name: 'S1', nominalDays: 0, start: monday },
    { id: 't1', name: 'T1', nominalDays: 4, start: monday, resourceId: 'marta', parentId: 's1' },
    { id: 't2', name: 'T2', nominalDays: 4, start: monday, resourceId: 'gino', parentId: 's1' },
    { id: 's2', name: 'S2', nominalDays: 0, start: monday, parentId: 's1' },
    {
      id: 't3',
      name: 'T3',
      nominalDays: 6,
      start: monday,
      resourceId: 'marta',
      parentId: 's2',
      predecessors: ['t1'],
    },
    { id: 't4', name: 'T4', nominalDays: 3, start: monday, resourceId: 'luca', parentId: 's2' },
    { id: 't5', name: 'T5', nominalDays: 2, start: monday, parentId: 's2' },
    {
      id: 't6',
      name: 'T6',
      nominalDays: 5,
      start: monday,
      resourceId: 'marta',
      parentId: 's2',
      disabled: true,
    },
    { id: 'm1', name: 'M1', nominalDays: 0, start: monday },
  ];
}

function fixtureCProject(rateOverrideFrom?: string): Project {
  return {
    calendar: fixtureCCalendar,
    currency: 'EUR',
    resources: [
      {
        id: 'marta',
        name: 'Marta',
        availability: 1,
        dailyRate: 600,
        ...(rateOverrideFrom
          ? { rateOverrides: [{ from: rateOverrideFrom, to: '2099-12-31', dailyRate: 650 }] }
          : {}),
      },
      { id: 'gino', name: 'Gino', availability: 0.5, dailyRate: 400 },
      { id: 'luca', name: 'Luca', availability: 1 },
    ],
    tasks: fixtureCTasks(),
  };
}

function buildFixtureC() {
  const draftSolved = solve(fixtureCProject());
  const draftPlan = buildPlan(draftSolved);
  const t3Start = parseWallClock(draftPlan.tasks.find((task) => task.id === 't3')!.start)!;

  // The third working day of T3: its own start day counts as the first, then
  // walk forward until two more working days have been crossed.
  const cursor = new Date(t3Start);
  for (let counted = 1; counted < 3; ) {
    cursor.setDate(cursor.getDate() + 1);
    if (draftSolved.calendar.isWorkingDate(cursor)) counted += 1;
  }
  const overrideFrom = serializeDate(cursor).slice(0, 10);

  const project = fixtureCProject(overrideFrom);
  const solved = solve(project);
  const plan = buildPlan(solved);

  // Self-check: if the override landed on the wrong day, every expected cell
  // value below is meaningless.
  const t3 = plan.tasks.find((task) => task.id === 't3')!;
  if (t3.cost !== 3800 || t3.dailyRates.length !== 2 || t3.dailyRates[0] !== 600 || t3.dailyRates[1] !== 650) {
    throw new Error(
      `Fixture C self-check failed: T3 cost=${t3.cost} dailyRates=${JSON.stringify(t3.dailyRates)}`,
    );
  }

  return { project, solved, plan };
}

describe('planFigure columns', () => {
  it('self-check: T3 straddles the raise at 3800, dailyRates [600, 650]', () => {
    const { plan } = buildFixtureC();
    const t3 = plan.tasks.find((task) => task.id === 't3')!;
    expect(t3.cost).toBe(3800);
    expect(t3.dailyRates).toEqual([600, 650]);
  });

  it('draws the given plan columns with a header band 18px taller, in registry order', () => {
    const { project, solved } = buildFixtureC();
    const base = planFigure(project, solved, { width: 1050 });
    const { svg, height } = planFigure(project, solved, {
      width: 1050,
      columns: ['resource_id', 'nominal_days', 'cost'],
    });

    expect(height - base.height).toBe(18);

    // Column left edges: 16 + 250, then + each figureWidth (110, 52, 84).
    const resourceHeader = /<text x="([\d.]+)" y="[^"]+" font-size="11" font-weight="600" fill="#6b7280">Resource<\/text>/.exec(
      svg,
    );
    const effortHeader = /<text x="([\d.]+)" y="[^"]+" font-size="11" font-weight="600" fill="#6b7280">Effort<\/text>/.exec(
      svg,
    );
    const costHeader = /<text x="([\d.]+)" y="[^"]+" font-size="11" font-weight="600" fill="#6b7280">Cost \(EUR\)<\/text>/.exec(
      svg,
    );
    expect(resourceHeader?.[1]).toBe('266');
    expect(effortHeader?.[1]).toBe('376');
    expect(costHeader?.[1]).toBe('428');

    // The timeline's left edge, 16 + 250 + (110 + 52 + 84).
    expect(svg).toMatch(/<line x1="512" y1="[\d.]+" x2="512" y2="[\d.]+" stroke="#dfe2e8" \/>/);

    // Cost cells, following the Fixture C table: T1 2,400; T2 1,600 (not
    // asserted here, only the ones the accept names); T3 3,800 plain; T4/T5
    // "—"; S2 ≥ 3,800; S1 ≥ 7,800; M1 empty (no cost text drawn for it).
    expect(svg.match(/>2,400</g)).toHaveLength(1);
    expect(svg.match(/>3,800</g)).toHaveLength(1);
    expect(svg.match(/>≥ 3,800</g)).toHaveLength(1);
    expect(svg.match(/>≥ 7,800</g)).toHaveLength(1);
    expect(svg.match(/>—</g)).toHaveLength(2);
    // Every row but M1 draws a cost cell; M1's is empty, so eight in total.
    const costCells = svg.match(/<text x="428" y="[^"]+" font-size="11" fill="#6b7280">/g);
    expect(costCells).toHaveLength(8);
  });

  it('columns: [] gives a header band with no labels, left edge 16 + 250', () => {
    const { project, solved } = buildFixtureC();
    const base = planFigure(project, solved, { width: 1050 });
    const { svg, height } = planFigure(project, solved, { width: 1050, columns: [] });

    expect(height - base.height).toBe(18);
    expect(svg).not.toMatch(/font-weight="600" fill="#6b7280"/);
    expect(svg).toMatch(/<line x1="266" y1="[\d.]+" x2="266" y2="[\d.]+" stroke="#dfe2e8" \/>/);
  });

  it('PLAN_COLUMNS marks exactly rate and cost as client-unsafe, and the figure draws whatever it is given', () => {
    const unsafe = PLAN_COLUMNS.filter((entry) => !entry.clientSafe)
      .map((entry) => entry.name)
      .sort();
    expect(unsafe).toEqual(['cost', 'rate']);

    const { project, solved } = buildFixtureC();
    const { svg } = planFigure(project, solved, { width: 1050, columns: ['cost'] });
    expect(svg).toContain('Cost (EUR)');
  });

  it('planFigurePages forwards columns: every page carries the same header strings at the same x', () => {
    const { project, solved } = buildFixtureC();
    const pages = planFigurePages(project, solved, {
      width: 1050,
      columns: ['resource_id', 'cost'],
      rowsPerPage: 4,
    });
    expect(pages.length).toBeGreaterThan(1);

    const headerOf = (svg: string) =>
      [...svg.matchAll(/<text x="([\d.]+)" y="[^"]+" font-size="11" font-weight="600" fill="#6b7280">([^<]+)<\/text>/g)].map(
        (match) => `${match[1]}:${match[2]}`,
      );
    const first = headerOf(pages[0].svg);
    expect(first).toEqual(['266:Resource', '376:Cost (EUR)']);
    for (const page of pages.slice(1)) {
      expect(headerOf(page.svg)).toEqual(first);
    }
  });

  it('draws columns in registry order regardless of the order given, and collapses a duplicate', () => {
    const { project, solved } = buildFixtureC();
    const { svg } = planFigure(project, solved, {
      width: 1050,
      columns: ['cost', 'resource_id', 'cost'],
    });
    const resourceHeader = /<text x="([\d.]+)"[^>]*>Resource<\/text>/.exec(svg);
    const costHeader = /<text x="([\d.]+)"[^>]*>Cost \(EUR\)<\/text>/.exec(svg);
    expect(Number(resourceHeader?.[1])).toBeLessThan(Number(costHeader?.[1]));
    expect(svg.match(/>Resource</g)).toHaveLength(1);
    expect(svg.match(/>Cost \(EUR\)</g)).toHaveLength(1);
  });
});

describe('tickUnit', () => {
  it('climbs from days to weeks to months as the columns narrow', () => {
    expect(tickUnit(20)).toBe('day');
    expect(tickUnit(18)).toBe('day');
    expect(tickUnit(17)).toBe('week');
    expect(tickUnit(30 / 7)).toBe('week');
    expect(tickUnit(4)).toBe('month');
  });
});

describe('planFigurePages', () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: String(index),
      name: `Attività ${index}`,
      nominalDays: 1,
      start: monday,
    }));

  function pagesOf(count: number, options?: Parameters<typeof planFigurePages>[2]) {
    const project: Project = { calendar, resources: people, tasks: many(count) };
    return planFigurePages(project, solve(project), options);
  }

  it('is one page for a plan that fits, and pages beyond that', () => {
    expect(pagesOf(10)).toHaveLength(1);
    expect(pagesOf(24)).toHaveLength(1);
    expect(pagesOf(25)).toHaveLength(2);
    expect(pagesOf(60, { rowsPerPage: 20 })).toHaveLength(3);
  });

  it('yields a page even for an empty plan, rather than nothing to print', () => {
    expect(pagesOf(0)).toHaveLength(1);
  });

  it('splits the rows without dropping or repeating one', () => {
    const pages = pagesOf(30, { rowsPerPage: 12 });
    const drawn = pages.flatMap((page) => [...page.svg.matchAll(/Attività (\d+)</g)].map((m) => Number(m[1])));
    expect(drawn).toEqual(Array.from({ length: 30 }, (_, index) => index));
  });

  it('measures the axis over the whole plan, so the pages line up', () => {
    const project: Project = {
      calendar,
      resources: people,
      tasks: [
        ...many(12),
        // Alone on the second page and a month later: measured page by page its
        // bar would start at the left edge, where the first page has 7 September.
        { id: 'late', name: 'Coda', nominalDays: 3, start: new Date(2026, 9, 12, 8, 0) },
      ],
    };
    const solved = solve(project);
    const width = 1050;
    const barStarts = (svg: string) =>
      [...svg.matchAll(/<rect x="([0-9.]+)" y="[0-9.]+" width="[0-9.]+" height="12"/g)].map(
        (match) => match[1],
      );
    const whole = barStarts(planFigure(project, solved, { width }).svg);
    const [, second] = planFigurePages(project, solved, { rowsPerPage: 12, width });
    expect(barStarts(second.svg)).toEqual([whole[whole.length - 1]]);
  });

  it('numbers the pages in the title only when there is more than one', () => {
    expect(pagesOf(10, { title: 'piano.gantt' })[0].svg).toContain('piano.gantt<');
    const paged = pagesOf(30, { title: 'piano.gantt', rowsPerPage: 12 });
    expect(paged[0].svg).toContain('piano.gantt — page 1 of 3');
    expect(paged[2].svg).toContain('piano.gantt — page 3 of 3');
  });

  it('is as tall as the rows it holds, so a short last page is short', () => {
    const [full, last] = pagesOf(13, { rowsPerPage: 12 });
    expect(full.height - last.height).toBe(11 * 24);
    expect(last.width).toBe(1050);
  });
});
