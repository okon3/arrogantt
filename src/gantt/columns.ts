/**
 * The plan columns a user can show or hide in the grid.
 *
 * Metadata only — a renderer lives beside what it renders (`GRID_CELLS` in
 * `gridColumns.ts`, a figure-side record later): this file never draws a
 * cell, it only says which columns exist, in what order, and how wide they
 * are.
 */

import type { DraftStorage } from './draft';
import type { Project } from './project';

export type PlanColumnName =
  | 'resource_id'
  | 'nominal_days'
  | 'start_date'
  | 'end_shown'
  | 'elapsed_days';

export interface PlanColumn {
  name: PlanColumnName;
  /** Header text. A later goal makes the currency label ride here. */
  label(project: Project): string;
  gridWidth: number;
  figureWidth: number;
  /** On screen before the user ever opens the picker. */
  defaultShown: boolean;
  /** Fit for a client's eyes — a later export dialog's default. */
  clientSafe: boolean;
}

/** Registry order = column order, in the grid and in the figure. */
export const PLAN_COLUMNS: readonly PlanColumn[] = [
  {
    name: 'resource_id',
    label: () => 'Resource',
    gridWidth: 76,
    figureWidth: 110,
    defaultShown: true,
    clientSafe: true,
  },
  {
    name: 'nominal_days',
    label: () => 'Effort',
    gridWidth: 62,
    figureWidth: 52,
    defaultShown: true,
    clientSafe: true,
  },
  {
    name: 'start_date',
    label: () => 'Start',
    gridWidth: 84,
    figureWidth: 76,
    defaultShown: true,
    clientSafe: true,
  },
  {
    name: 'end_shown',
    label: () => 'End',
    gridWidth: 84,
    figureWidth: 76,
    defaultShown: true,
    clientSafe: true,
  },
  {
    name: 'elapsed_days',
    label: () => 'Duration',
    gridWidth: 62,
    figureWidth: 60,
    defaultShown: true,
    clientSafe: true,
  },
];

const REGISTRY_NAMES: ReadonlySet<string> = new Set(PLAN_COLUMNS.map((entry) => entry.name));

const COLUMNS_KEY = 'yagni.columns.v1';

export function defaultColumnSelection(): ReadonlySet<PlanColumnName> {
  return new Set(PLAN_COLUMNS.filter((entry) => entry.defaultShown).map((entry) => entry.name));
}

/**
 * The shown set, from whatever the user last picked.
 *
 * The stored value is the shown names, never the hidden ones: a name the
 * registry has dropped, or one a bug once wrote, can only fail to show a
 * column that no longer exists — it can never resurrect one nobody asked for.
 */
export function readColumnSelection(storage: DraftStorage | undefined): ReadonlySet<PlanColumnName> {
  let raw: string | null;
  try {
    raw = storage?.getItem(COLUMNS_KEY) ?? null;
  } catch {
    return defaultColumnSelection();
  }
  if (raw === null) return defaultColumnSelection();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === 'string')) {
      return defaultColumnSelection();
    }
    const shown = new Set<PlanColumnName>();
    for (const name of parsed) {
      if (REGISTRY_NAMES.has(name)) shown.add(name as PlanColumnName);
    }
    return shown;
  } catch {
    return defaultColumnSelection();
  }
}

export function writeColumnSelection(
  storage: DraftStorage | undefined,
  shown: ReadonlySet<PlanColumnName>,
): void {
  try {
    const ordered = PLAN_COLUMNS.filter((entry) => shown.has(entry.name)).map((entry) => entry.name);
    storage?.setItem(COLUMNS_KEY, JSON.stringify(ordered));
  } catch {
    // Unlike the draft there is nothing stale to clear: worst case the next
    // picker change or reload falls back to the defaults.
  }
}
