/**
 * The plan columns a user can show or hide in the grid.
 *
 * Metadata only — a renderer lives beside what it renders (`GRID_CELLS` in
 * `gridColumns.ts`, `FIGURE_CELLS` in `planFigure.ts`): this file never draws
 * a cell, it only says which columns exist, in what order, and how wide they
 * are.
 */

import { currencyLabel } from './costCells';
import type { DraftStorage } from './draft';
import type { Project } from './project';

export type PlanColumnName =
  | 'resource_id'
  | 'nominal_days'
  | 'start_date'
  | 'end_shown'
  | 'elapsed_days'
  | 'rate'
  | 'cost';

export interface PlanColumn {
  name: PlanColumnName;
  /** Header text; the currency label rides here, on the cost columns. */
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
  // The first two labels that read `project`: a rate or a cost is meaningless
  // without the currency it is in, and the label is the only place that unit
  // may show (§5.4 — cells stay bare numbers).
  //
  // Both widths are measured, and **against different strings** — a figure has
  // no legal maximum (`dailyRate` is only finite and non-negative, so no width
  // can promise every cell fits) while a header has one (`validateCurrency`
  // caps a currency at 8 characters), so which string governs is a judgement
  // about what is plausible, not a rule.
  //
  // `rate` is sized against its **header**: 84 holds the widest
  // three-character currency in both fonts the header can render in
  // (`Rate (WWW)`: 79.22px in dhtmlx's Inter, 76.61px in its fallback —
  // `docs/dhtmlx.md`), and past three characters the cut is accepted, since
  // `Rate (WWWWWWWW)` wants 140px of a 706px grid. A head cell has no padding
  // and clips without an ellipsis, so an overflowing label abuts its
  // neighbour's and the two read as one word.
  //
  // `cost` is sized against a **cell**, because its widest plausible string is
  // one: a partially costed summary prefixes `≥ `, which costs 12.47px on top
  // of the same figure bare (8.91 of glyph plus a 3.56 space) — measured, not
  // subtracted from a neighbouring row, which is how the 5.5px this comment
  // first carried came about (a prefixed 8-digit total against a bare
  // 9-digit one). Measured in the cell's own font (system-ui 13px, not the
  // header's): `≥ 122,250,000` is 81.19px and `≥ 12,250,000` 74.17px, against
  // a content box of `gridWidth - 12` (the cell's 6px padding a side) that is
  // clipped by the inner `.gantt_tree_content`, not by the cell. 98 leaves the
  // nine-digit case 4.81px of margin — the same order F14 kept on the header
  // rather than the 0.81px a 94 would leave, which is not a margin. Ten digits
  // overflow again and are accepted: that is a plan worth a billion.
  {
    name: 'rate',
    label: (project) => currencyLabel('Rate', project.currency ?? null),
    gridWidth: 84,
    figureWidth: 70,
    defaultShown: false,
    clientSafe: false,
  },
  {
    name: 'cost',
    label: (project) => currencyLabel('Cost', project.currency ?? null),
    gridWidth: 98,
    figureWidth: 84,
    defaultShown: false,
    clientSafe: false,
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
