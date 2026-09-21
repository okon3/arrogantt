/**
 * What an export draws, kept apart from the grid's own column selection.
 *
 * The registry (`columns.ts`) is shared, but the choice of which columns show
 * is per caller — the grid and an export pick differently at the same moment
 * (Goal G's cross-goal constraint with F). This is the export side's half:
 * the type, its persistence, and the fallback a caller resolves before the
 * settings dialog (G3b) ever writes one.
 */

import { PLAN_COLUMNS, type PlanColumnName } from './columns';
import type { DraftStorage } from './draft';

export interface ExportSettings {
  /** 'visible' respects the closed branches of the grid; 'all' draws every row. */
  scope: 'all' | 'visible';
  columns: ReadonlySet<PlanColumnName>;
}

const REGISTRY_NAMES: ReadonlySet<string> = new Set(PLAN_COLUMNS.map((entry) => entry.name));

const EXPORT_SETTINGS_KEY = 'arrogantt.export.v1';

function isScope(value: unknown): value is ExportSettings['scope'] {
  return value === 'all' || value === 'visible';
}

/** Null when nothing was ever stored — the caller resolves the default. */
export function readExportSettings(storage: DraftStorage | undefined): ExportSettings | null {
  let raw: string | null;
  try {
    raw = storage?.getItem(EXPORT_SETTINGS_KEY) ?? null;
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as { columns?: unknown }).columns) ||
      !isScope((parsed as { scope?: unknown }).scope)
    ) {
      return null;
    }
    const rawColumns = (parsed as { columns: unknown[] }).columns;
    if (!rawColumns.every((entry) => typeof entry === 'string')) return null;
    const columns = new Set<PlanColumnName>();
    for (const name of rawColumns) {
      if (REGISTRY_NAMES.has(name)) columns.add(name as PlanColumnName);
    }
    return { scope: (parsed as { scope: ExportSettings['scope'] }).scope, columns };
  } catch {
    return null;
  }
}

export function writeExportSettings(
  storage: DraftStorage | undefined,
  settings: ExportSettings,
): void {
  try {
    const ordered = PLAN_COLUMNS.filter((entry) => settings.columns.has(entry.name)).map(
      (entry) => entry.name,
    );
    storage?.setItem(
      EXPORT_SETTINGS_KEY,
      JSON.stringify({ scope: settings.scope, columns: ordered }),
    );
  } catch {
    // Worst case the next confirm or reload falls back to the resolved default.
  }
}

/**
 * What an export uses before the dialog has ever been confirmed: today's
 * behaviour, so an update never changes what comes out under anyone's feet.
 */
export function resolveExportSettings(
  stored: ExportSettings | null,
  gridColumns: ReadonlySet<PlanColumnName>,
): ExportSettings {
  return stored ?? { scope: 'all', columns: gridColumns };
}

/**
 * The settings as `planFigure`/`planFigurePages` want them. One home: PNG and
 * print translate identically, and a third caller would have copied it again.
 *
 * `collapsedBranches` is a thunk so this module never reaches for the chart —
 * and it is not called at all under `scope: 'all'`, which must draw every row
 * however the grid is currently folded.
 */
export function figureOptionsFrom(
  settings: ExportSettings,
  collapsedBranches: () => ReadonlySet<string> | undefined,
): { columns: PlanColumnName[]; collapsedIds: ReadonlySet<string> | undefined } {
  return {
    // Unconditional on purpose: an emptied selection is `[]`, and only an
    // absent list means the legacy outline (`planFigure.ts`, `selected`).
    columns: [...settings.columns],
    collapsedIds: settings.scope === 'visible' ? collapsedBranches() : undefined,
  };
}
