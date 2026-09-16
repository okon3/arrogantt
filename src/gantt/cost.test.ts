import { describe, expect, it } from 'vitest';
import { dayIndexOfString } from '../scheduler';
import { rateOnDay, validateCurrency, type Person } from './cost';

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
});
