import { describe, expect, it } from 'vitest';
import type { AvailabilityOverride } from '../scheduler';
import type { Person, RateOverride } from './cost';
import {
  nextResourceId,
  releasedBy,
  validateResources,
  withAvailability,
  withResourceAdded,
  withResourceRemoved,
  withResourceUpdated,
} from './resources';

const person = (id: string, name: string, availability = 1): Person => ({
  id,
  name,
  availability,
});

describe('validateResources', () => {
  it('accepts a plain list', () => {
    expect(validateResources([person('r1', 'Marta'), person('r2', 'Bruno', 0.5)])).toBeNull();
  });

  it('refuses a person with no name', () => {
    expect(validateResources([person('r1', '   ')])).toBe('Every person needs a name');
  });

  it('refuses a duplicate name whatever its case', () => {
    expect(validateResources([person('r1', 'Marta'), person('r2', 'MARTA')])).toBe(
      'Duplicate name: "MARTA"',
    );
  });

  it('refuses a default availability of zero', () => {
    expect(validateResources([person('r1', 'Marta', 0)])).toMatch(/Invalid availability/);
  });

  it('refuses a default availability above one', () => {
    // The mistake an agent makes when it hands over a percentage.
    expect(validateResources([person('r1', 'Marta', 50)])).toMatch(/Invalid availability/);
  });

  it('refuses a period missing one of its ends', () => {
    const resource: Person = {
      ...person('r1', 'Marta'),
      availabilityOverrides: [{ from: '2026-09-07', to: '', availability: 0 }],
    };
    expect(validateResources([resource])).toBe('A period of "Marta" has no start or end');
  });

  it('accepts a period at zero, which is how an absence is written', () => {
    const resource: Person = {
      ...person('r1', 'Marta'),
      availabilityOverrides: [{ from: '2026-09-07', to: '2026-09-11', availability: 0 }],
    };
    expect(validateResources([resource])).toBeNull();
  });

  it('refuses a period whose availability field is missing', () => {
    // The agent-API repro: `{from, to, ratio: 0}` — the field misspelt, so the
    // share is undefined and would reach the scheduler as NaN capacity.
    const resource: Person = {
      ...person('r1', 'Marta'),
      availabilityOverrides: [
        { from: '2026-09-07', to: '2026-09-11', ratio: 0 } as unknown as AvailabilityOverride,
      ],
    };
    expect(validateResources([resource])).toMatch(/needs a numeric "availability" share/);
  });

  it('refuses a period whose date is not a day string', () => {
    const resource: Person = {
      ...person('r1', 'Marta'),
      availabilityOverrides: [{ from: '07/09/2026', to: '2026-09-11', availability: 0 }],
    };
    expect(validateResources([resource])).toMatch(/malformed date/);
  });

  it('refuses a period share above one', () => {
    const resource: Person = {
      ...person('r1', 'Marta'),
      availabilityOverrides: [{ from: '2026-09-07', to: '2026-09-11', availability: 2 }],
    };
    expect(validateResources([resource])).toBe('A period of "Marta" has a share outside 0..1');
  });

  it('accepts a default rate of zero, unlike availability', () => {
    const resource: Person = { ...person('r1', 'Marta'), dailyRate: 0 };
    expect(validateResources([resource])).toBeNull();
  });

  it('refuses a negative default rate', () => {
    const resource: Person = { ...person('r1', 'Marta'), dailyRate: -1 };
    expect(validateResources([resource])).toBe(
      'Invalid daily rate for "Marta": expected a number of 0 or more',
    );
  });

  it('refuses a non-finite default rate', () => {
    const resource: Person = { ...person('r1', 'Marta'), dailyRate: Number.NaN };
    expect(validateResources([resource])).toBe(
      'Invalid daily rate for "Marta": expected a number of 0 or more',
    );
  });

  it('accepts a rate override without a default: unknown outside it, known inside', () => {
    const resource: Person = {
      ...person('r1', 'Marta'),
      rateOverrides: [{ from: '2026-09-07', to: '2026-09-11', dailyRate: 500 }],
    };
    expect(validateResources([resource])).toBeNull();
  });

  it('refuses a rate period missing one of its ends', () => {
    const resource: Person = {
      ...person('r1', 'Marta'),
      rateOverrides: [{ from: '2026-09-07', to: '', dailyRate: 500 } as RateOverride],
    };
    expect(validateResources([resource])).toBe('A rate period of "Marta" has no start or end');
  });

  it('refuses a rate period whose date is not a day string', () => {
    const resource: Person = {
      ...person('r1', 'Marta'),
      rateOverrides: [{ from: '07/09/2026', to: '2026-09-11', dailyRate: 500 }],
    };
    expect(validateResources([resource])).toBe(
      'A rate period of "Marta" has a malformed date: expected YYYY-MM-DD',
    );
  });

  it('refuses a rate period with no numeric dailyRate', () => {
    const resource: Person = {
      ...person('r1', 'Marta'),
      rateOverrides: [
        { from: '2026-09-07', to: '2026-09-11' } as unknown as RateOverride,
      ],
    };
    expect(validateResources([resource])).toBe(
      'A rate period of "Marta" needs a numeric "dailyRate"',
    );
  });

  // `Infinity` reaches the text as `null`, which this application's own parser
  // refuses: the gate has to stop it before the model holds it.
  it('refuses a rate period whose rate is not finite', () => {
    const resource: Person = {
      ...person('r1', 'Marta'),
      rateOverrides: [{ from: '2026-09-07', to: '2026-09-11', dailyRate: Number.POSITIVE_INFINITY }],
    };
    expect(validateResources([resource])).toBe(
      'A rate period of "Marta" needs a numeric "dailyRate"',
    );
  });

  it('refuses a rate period with a negative rate', () => {
    const resource: Person = {
      ...person('r1', 'Marta'),
      rateOverrides: [{ from: '2026-09-07', to: '2026-09-11', dailyRate: -50 }],
    };
    expect(validateResources([resource])).toBe('A rate period of "Marta" has a negative rate');
  });

  it('accepts a rate period at zero, a declared free stretch', () => {
    const resource: Person = {
      ...person('r1', 'Marta'),
      dailyRate: 600,
      rateOverrides: [{ from: '2026-09-07', to: '2026-09-11', dailyRate: 0 }],
    };
    expect(validateResources([resource])).toBeNull();
  });
});

describe('releasedBy', () => {
  it('names the resources that disappeared', () => {
    const previous = [person('r1', 'Marta'), person('r2', 'Bruno'), person('r3', 'Ada')];
    expect(releasedBy(previous, [previous[1]])).toEqual(['r1', 'r3']);
  });

  it('releases nobody when the list only changed in place', () => {
    const previous = [person('r1', 'Marta'), person('r2', 'Bruno')];
    const next = [person('r1', 'Marta Rossi'), person('r2', 'Bruno', 0.5)];
    expect(releasedBy(previous, next)).toEqual([]);
  });

  it('releases nobody when somebody was added', () => {
    const previous = [person('r1', 'Marta')];
    expect(releasedBy(previous, [...previous, person('r2', 'Bruno')])).toEqual([]);
  });
});

describe('nextResourceId', () => {
  it('starts at r1', () => {
    expect(nextResourceId([])).toBe('r1');
  });

  it('goes past the highest number in use, not past the count', () => {
    expect(nextResourceId([person('r1', 'Marta'), person('r7', 'Bruno')])).toBe('r8');
  });

  it('ignores ids that do not follow the pattern', () => {
    expect(nextResourceId([person('alice', 'Alice')])).toBe('r1');
  });
});

describe('the transformations', () => {
  it('adds a person with a fresh id and full availability by default', () => {
    const next = withResourceAdded([person('r1', 'Marta')], { name: ' Bruno ' });
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ id: 'r2', name: 'Bruno', availability: 1 });
  });

  it('leaves the fields a patch does not mention', () => {
    const previous = [
      {
        ...person('r1', 'Marta', 0.5),
        availabilityOverrides: [{ from: '2026-09-07', to: '2026-09-11', availability: 0 }],
      },
    ];
    const next = withResourceUpdated(previous, 'r1', { name: 'Marta Rossi' });
    expect(next[0].availability).toBe(0.5);
    expect(next[0].availabilityOverrides).toHaveLength(1);
  });

  it('omits an empty override list rather than storing it', () => {
    const previous = [
      {
        ...person('r1', 'Marta'),
        availabilityOverrides: [{ from: '2026-09-07', to: '2026-09-11', availability: 0 }],
      },
    ];
    expect(withAvailability(previous, 'r1', [])).toEqual([
      { id: 'r1', name: 'Marta', availability: 1 },
    ]);
  });

  it('replaces the whole ordered override list, because the order is semantics', () => {
    const overrides = [
      { from: '2026-09-01', to: '2026-09-30', availability: 0.5 },
      { from: '2026-09-14', to: '2026-09-18', availability: 0 },
    ];
    const next = withAvailability([person('r1', 'Marta')], 'r1', overrides);
    expect(next[0].availabilityOverrides).toEqual(overrides);
  });

  it('removes only the named person', () => {
    const previous = [person('r1', 'Marta'), person('r2', 'Bruno')];
    expect(withResourceRemoved(previous, 'r1')).toEqual([previous[1]]);
  });

  it('leaves the rate alone when the patch does not mention it', () => {
    const previous = [{ ...person('r1', 'Marta'), dailyRate: 600 }];
    const next = withResourceUpdated(previous, 'r1', { name: 'Marta Rossi' });
    expect(next[0].dailyRate).toBe(600);
  });

  it('sets a rate of zero without dropping it as falsy', () => {
    const next = withResourceUpdated([person('r1', 'Marta')], 'r1', { dailyRate: 0 });
    expect(next[0].dailyRate).toBe(0);
  });

  it('clears the default rate with null, leaves it with undefined', () => {
    const previous = [{ ...person('r1', 'Marta'), dailyRate: 600 }];
    const cleared = withResourceUpdated(previous, 'r1', { dailyRate: null });
    expect('dailyRate' in cleared[0]).toBe(false);
    const left = withResourceUpdated(previous, 'r1', {});
    expect(left[0].dailyRate).toBe(600);
  });

  it('omits an empty rate override list rather than storing it', () => {
    const previous = [
      {
        ...person('r1', 'Marta'),
        rateOverrides: [{ from: '2026-09-07', to: '2026-09-11', dailyRate: 0 }],
      },
    ];
    const next = withResourceUpdated(previous, 'r1', { rateOverrides: [] });
    expect('rateOverrides' in next[0]).toBe(false);
  });
});
