import { describe, expect, it } from 'vitest';
import { PLAN_COLUMNS, type PlanColumnName } from './columns';
import type { DraftStorage } from './draft';
import {
  figureOptionsFrom,
  readExportSettings,
  resolveExportSettings,
  writeExportSettings,
  type ExportSettings,
} from './exportSettings';

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

const KEY = 'arrogantt.export.v1';

describe('reading the stored export settings', () => {
  it('round-trips what it was given, columns in registry order', () => {
    const storage = fakeStorage();
    const settings: ExportSettings = {
      scope: 'visible',
      columns: new Set<PlanColumnName>(['elapsed_days', 'resource_id']),
    };
    writeExportSettings(storage, settings);
    expect(readExportSettings(storage)).toEqual({
      scope: 'visible',
      columns: new Set(['resource_id', 'elapsed_days']),
    });
  });

  it('is null when the key is absent', () => {
    expect(readExportSettings(fakeStorage())).toBeNull();
  });

  it('is null when there is no storage', () => {
    expect(readExportSettings(undefined)).toBeNull();
  });

  it('is null when getItem throws, and setItem never throws', () => {
    const storage = fakeStorage(true);
    expect(readExportSettings(storage)).toBeNull();
    expect(() =>
      writeExportSettings(storage, { scope: 'all', columns: new Set() }),
    ).not.toThrow();
  });

  it('is null on broken JSON', () => {
    const storage = fakeStorage();
    storage.entries.set(KEY, '{');
    expect(readExportSettings(storage)).toBeNull();
  });

  it('is null when columns is not an array', () => {
    const storage = fakeStorage();
    storage.entries.set(KEY, JSON.stringify({ scope: 'all', columns: 'resource_id' }));
    expect(readExportSettings(storage)).toBeNull();
  });

  it('is null when scope is absent', () => {
    const storage = fakeStorage();
    storage.entries.set(KEY, JSON.stringify({ columns: ['resource_id'] }));
    expect(readExportSettings(storage)).toBeNull();
  });

  it('is null when scope is neither "all" nor "visible"', () => {
    const storage = fakeStorage();
    storage.entries.set(KEY, JSON.stringify({ scope: 'some', columns: [] }));
    expect(readExportSettings(storage)).toBeNull();
  });

  it('drops a column name that is not in the registry, and keeps the rest', () => {
    const storage = fakeStorage();
    storage.entries.set(KEY, JSON.stringify({ scope: 'all', columns: ['bogus', 'elapsed_days'] }));
    expect(readExportSettings(storage)).toEqual({
      scope: 'all',
      columns: new Set(['elapsed_days']),
    });
  });
});

describe('writing the export settings', () => {
  it('writes the columns in registry order', () => {
    const storage = fakeStorage();
    writeExportSettings(storage, {
      scope: 'all',
      columns: new Set<PlanColumnName>(['cost', 'resource_id']),
    });
    const parsed = JSON.parse(storage.entries.get(KEY) ?? '{}');
    expect(parsed.columns).toEqual(['resource_id', 'cost']);
  });

  it('is a no-op, without throwing, when there is no storage', () => {
    expect(() =>
      writeExportSettings(undefined, { scope: 'all', columns: new Set() }),
    ).not.toThrow();
  });
});

describe('resolving export settings', () => {
  const grid: ReadonlySet<PlanColumnName> = new Set(['resource_id', 'start_date']);

  it('falls back to scope "all" and the grid columns when nothing was stored', () => {
    expect(resolveExportSettings(null, grid)).toEqual({ scope: 'all', columns: grid });
  });

  it('returns the stored settings unchanged, ignoring the grid', () => {
    const stored: ExportSettings = { scope: 'visible', columns: new Set(['cost']) };
    expect(resolveExportSettings(stored, grid)).toBe(stored);
  });
});

describe('the registry names used by these tests', () => {
  it('actually exist', () => {
    expect(PLAN_COLUMNS.some((entry) => entry.name === 'elapsed_days')).toBe(true);
    expect(PLAN_COLUMNS.some((entry) => entry.name === 'cost')).toBe(true);
  });
});

describe('mapping export settings onto figure options', () => {
  const collapsed: ReadonlySet<string> = new Set(['t1']);

  it('passes the closed branches only under scope "visible"', () => {
    const settings: ExportSettings = { scope: 'visible', columns: new Set(['cost']) };
    expect(figureOptionsFrom(settings, () => collapsed).collapsedIds).toBe(collapsed);
  });

  it('never asks for them under scope "all", however the grid is folded', () => {
    let asked = 0;
    const settings: ExportSettings = { scope: 'all', columns: new Set(['cost']) };
    const options = figureOptionsFrom(settings, () => {
      asked += 1;
      return collapsed;
    });
    expect(options.collapsedIds).toBeUndefined();
    expect(asked).toBe(0);
  });

  it('gives an array, empty rather than absent, so an emptied selection is not the legacy outline', () => {
    const settings: ExportSettings = { scope: 'all', columns: new Set() };
    expect(figureOptionsFrom(settings, () => undefined).columns).toEqual([]);
  });
});
