import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from '../scheduler';
import type { Person } from './cost';
import { deserializeProject, serializeProject } from './serialization';
import { validateResources } from './resources';
import { blankDraft, toDraft, toResources } from './resourceDrafts';

describe('toResources: availability, absent stays absent', () => {
  it('omits availability when the person never declared one', () => {
    const result = toResources(toDraft([{ id: 'r1', name: 'X' }]));
    expect(Object.keys(result[0])).toEqual(['id', 'name']);
  });

  it('keeps a declared availability of 0.5 unedited', () => {
    const result = toResources(toDraft([{ id: 'r1', name: 'X', availability: 0.5 }]));
    expect(result[0].availability).toBe(0.5);
  });

  it('keeps a declared availability of 1 unedited', () => {
    const result = toResources(toDraft([{ id: 'r1', name: 'X', availability: 1 }]));
    expect(Object.keys(result[0])).toContain('availability');
    expect(result[0].availability).toBe(1);
  });

  it('writes availability 0.5 when an undeclared draft is edited to 50%', () => {
    const drafts = toDraft([{ id: 'r1', name: 'X' }]);
    drafts[0].availability = '50';
    const result = toResources(drafts);
    expect(result[0].availability).toBe(0.5);
  });

  it('writes availability 1 when a declared 0.5 draft is edited to 100%', () => {
    const drafts = toDraft([{ id: 'r1', name: 'X', availability: 0.5 }]);
    drafts[0].availability = '100';
    const result = toResources(drafts);
    expect(result[0].availability).toBe(1);
  });
});

describe('toResources: the other optional keys, absent stays absent', () => {
  it('omits availabilityOverrides when there is none', () => {
    const result = toResources(toDraft([{ id: 'r1', name: 'X' }]));
    expect('availabilityOverrides' in result[0]).toBe(false);
  });

  it('keeps a single override unchanged', () => {
    const overrides = [{ from: '2026-09-08', to: '2026-09-09', availability: 0 }];
    const result = toResources(toDraft([{ id: 'r1', name: 'X', availabilityOverrides: overrides }]));
    expect(result[0].availabilityOverrides).toEqual(overrides);
  });

  it('omits an empty availabilityOverrides array rather than storing it', () => {
    const result = toResources(
      toDraft([{ id: 'r1', name: 'X', availabilityOverrides: [] }]),
    );
    expect('availabilityOverrides' in result[0]).toBe(false);
  });

  it('omits dailyRate when there is none', () => {
    const result = toResources(toDraft([{ id: 'r1', name: 'X' }]));
    expect('dailyRate' in result[0]).toBe(false);
  });

  it('keeps a declared dailyRate of 0', () => {
    const result = toResources(toDraft([{ id: 'r1', name: 'X', dailyRate: 0 }]));
    expect(result[0].dailyRate).toBe(0);
  });

  it('omits dailyRate when the rate text is edited to blank', () => {
    const drafts = toDraft([{ id: 'r1', name: 'X', dailyRate: 600 }]);
    drafts[0].dailyRate = '';
    const result = toResources(drafts);
    expect('dailyRate' in result[0]).toBe(false);
  });

  it('writes NaN for an unparseable rate, and validateResources refuses it', () => {
    const drafts = toDraft([{ id: 'r1', name: 'X', dailyRate: 600 }]);
    drafts[0].dailyRate = 'abc';
    const result = toResources(drafts);
    expect(Number.isNaN(result[0].dailyRate)).toBe(true);
    expect(validateResources(result)).toMatch(/Invalid daily rate/);
  });

  it('omits rateOverrides when there is none', () => {
    const result = toResources(toDraft([{ id: 'r1', name: 'X' }]));
    expect('rateOverrides' in result[0]).toBe(false);
  });

  it('keeps a single rate override unchanged', () => {
    const rateOverrides = [{ from: '2026-09-08', to: '2026-09-09', dailyRate: 400 }];
    const result = toResources(toDraft([{ id: 'r1', name: 'X', rateOverrides }]));
    expect(result[0].rateOverrides).toEqual(rateOverrides);
  });

  it('trims the name', () => {
    const result = toResources(toDraft([{ id: 'r1', name: '  Marta  ' }]));
    expect(result[0].name).toBe('Marta');
  });
});

describe('whole-shape round trips', () => {
  it('round-trips a list mixing bare, fully-declared, and edge-value people', () => {
    const people: Person[] = [
      { id: 'r1', name: 'Bare' },
      {
        id: 'r2',
        name: 'Full',
        availability: 0.5,
        availabilityOverrides: [{ from: '2026-09-08', to: '2026-09-09', availability: 0 }],
        dailyRate: 600,
        rateOverrides: [{ from: '2026-09-08', to: '2026-09-09', dailyRate: 650 }],
      },
      { id: 'r3', name: 'Full time only', availability: 1 },
      { id: 'r4', name: 'Free', dailyRate: 0 },
    ];
    expect(toResources(toDraft(people))).toEqual(people);
  });

  it('opening and saving People on a file with no availability key adds nothing', () => {
    const text = JSON.stringify({
      format: 'gantt-effort-split',
      version: 2,
      calendar: DEFAULT_CALENDAR,
      resources: [{ id: 'r1', name: 'Marta' }],
      tasks: [],
    });
    const parsed = deserializeProject(text);
    const resources = toResources(toDraft(parsed.resources));
    const roundTripped = { ...parsed, resources };
    expect(serializeProject(roundTripped)).toBe(serializeProject(parsed));
  });
});

describe('blankDraft', () => {
  it('assigns the next id and writes a declared full-time availability', () => {
    const current = toDraft([{ id: 'r1', name: 'Existing' }]);
    const fresh = blankDraft(current);
    expect(fresh.id).toBe('r2');
    const result = toResources([...current, fresh]);
    expect(result[1]).toEqual({ id: 'r2', name: '', availability: 1 });
  });
});
