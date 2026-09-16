import { describe, expect, it } from 'vitest';
import type { DraftStorage } from './draft';
import {
  PLAN_COLUMNS,
  defaultColumnSelection,
  readColumnSelection,
  writeColumnSelection,
  type PlanColumnName,
} from './columns';

function fakeStorage(failing = false): DraftStorage & { entries: Map<string, string> } {
  const entries = new Map<string, string>();
  const fail = () => {
    throw new Error('storage refused');
  };
  return {
    entries,
    getItem: failing ? fail : (key) => entries.get(key) ?? null,
    setItem: failing ? fail : (key, value) => void entries.set(key, value),
    removeItem: failing ? fail : (key) => void entries.delete(key),
  };
}

const ALL_NAMES = PLAN_COLUMNS.map((entry) => entry.name);
const DEFAULT_SHOWN_NAMES = PLAN_COLUMNS.filter((entry) => entry.defaultShown).map(
  (entry) => entry.name,
);

describe('the default column selection', () => {
  it('is every registry entry whose defaultShown is true', () => {
    expect([...defaultColumnSelection()].sort()).toEqual([...DEFAULT_SHOWN_NAMES].sort());
  });

  it('excludes an entry whose defaultShown is false', () => {
    const hidden = PLAN_COLUMNS.filter((entry) => !entry.defaultShown).map((entry) => entry.name);
    expect(hidden.length).toBeGreaterThan(0);
    for (const name of hidden) expect(defaultColumnSelection().has(name)).toBe(false);
  });
});

describe('reading the stored column selection', () => {
  it('falls back to the defaults when the key is absent', () => {
    expect(readColumnSelection(fakeStorage())).toEqual(defaultColumnSelection());
  });

  it('falls back to the defaults when there is no storage', () => {
    expect(readColumnSelection(undefined)).toEqual(defaultColumnSelection());
  });

  it('round-trips a shown set it was given', () => {
    const storage = fakeStorage();
    const shown: ReadonlySet<PlanColumnName> = new Set(['resource_id', 'start_date']);
    writeColumnSelection(storage, shown);
    expect(readColumnSelection(storage)).toEqual(shown);
  });

  it('falls back to the defaults when the stored value is not a JSON array of strings', () => {
    const storage = fakeStorage();
    storage.entries.set('yagni.columns.v1', '{');
    expect(readColumnSelection(storage)).toEqual(defaultColumnSelection());
    storage.entries.set('yagni.columns.v1', '"x"');
    expect(readColumnSelection(storage)).toEqual(defaultColumnSelection());
    storage.entries.set('yagni.columns.v1', JSON.stringify({ resource_id: true }));
    expect(readColumnSelection(storage)).toEqual(defaultColumnSelection());
  });

  it('drops a name that is not in the registry, silently', () => {
    const storage = fakeStorage();
    storage.entries.set('yagni.columns.v1', JSON.stringify(['bogus', 'elapsed_days']));
    expect(readColumnSelection(storage)).toEqual(new Set(['elapsed_days']));
  });

  it('hides a registry name absent from the stored array', () => {
    const storage = fakeStorage();
    storage.entries.set('yagni.columns.v1', JSON.stringify(['resource_id']));
    expect(readColumnSelection(storage)).toEqual(new Set(['resource_id']));
  });

  it('does not throw when storage refuses every call', () => {
    const storage = fakeStorage(true);
    expect(readColumnSelection(storage)).toEqual(defaultColumnSelection());
    expect(() => writeColumnSelection(storage, new Set(ALL_NAMES))).not.toThrow();
  });
});

describe('writing the column selection', () => {
  it('writes only the shown names, in registry order', () => {
    const storage = fakeStorage();
    writeColumnSelection(storage, new Set(['elapsed_days', 'resource_id']));
    expect(JSON.parse(storage.entries.get('yagni.columns.v1') ?? '[]')).toEqual([
      'resource_id',
      'elapsed_days',
    ]);
  });

  it('is a no-op, without throwing, when there is no storage', () => {
    expect(() => writeColumnSelection(undefined, defaultColumnSelection())).not.toThrow();
  });
});
