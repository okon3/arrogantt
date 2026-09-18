import { formatDays, formatMoney } from './format';

/**
 * What a cost or rate cell says, in either medium: the grid renders it as an
 * HTML string, the details dialog as JSX. One rule, two renderers — and the
 * `derived` register is a flag, not a class, because the two surfaces name it
 * differently (`gantt-derived` in the grid, `taskinfo__derived` in a dialog).
 */
export interface CellText {
  /** Empty string = the cell says nothing at all. */
  text: string;
  /** Hover explanation, raw — the HTML caller escapes it. */
  title: string | null;
  derived: boolean;
}

/**
 * The Rate cell: the row's own segments' distinct rates, ascending.
 *
 * A milestone is every non-summary leaf `isMilestone` marks (zero effort), so
 * there is no "leaf with effort and no rate" case left uncovered by the dash
 * below — the two guards account for the whole domain.
 */
export function rateCellText(row: {
  dailyRates: readonly number[];
  isSummary: boolean;
  isMilestone: boolean;
}): CellText {
  if (row.isSummary || row.isMilestone) return { text: '', title: null, derived: false };
  const rates = row.dailyRates;
  if (rates.length === 0) return { text: '—', title: null, derived: true };
  if (rates.length === 1) return { text: formatMoney(rates[0]), title: null, derived: false };
  // A range, not every distinct value: the tooltip's own Share range reads
  // the same way (min–max), and a mid-task rate change is what it is for.
  return {
    text: `${formatMoney(rates[0])}–${formatMoney(rates[rates.length - 1])}`,
    title: null,
    derived: false,
  };
}

/**
 * The Cost cell: what a row's effort costs, or why it does not have a figure.
 */
export function costCellText(row: {
  /** This row's own effort, rolled up on a summary. Zero = nothing to price. */
  effortDays: number;
  /** `reportedCost`'s output. Never re-derive it from the day counts. */
  cost: number | null;
  uncostedDays: number;
  /** The row's assigned person, or null — only ever used in the reason. */
  resourceName: string | null;
  isSummary: boolean;
}): CellText {
  // effortDays is this row's effort on both branches — a summary's rolled-up
  // total and a leaf's own days — so a milestone and an all-zero summary
  // share it, and one check clears both without a second effort concept.
  if (row.effortDays === 0) return { text: '', title: null, derived: false };
  // The null rule lives in reportedCost (cost.ts) — `cost` is its output,
  // never re-derived from the day counts here.
  if (row.cost === null) {
    // A summary's resourceName is the assignment its row carried while it was
    // still a leaf (the grid's raw resource_id is never rolled up) — naming
    // that person here would report someone nobody on this row is working.
    const name = row.isSummary ? null : row.resourceName;
    const reason = name ? `No rate for ${name} on these days` : 'No resource';
    return { text: '—', title: reason, derived: true };
  }
  if (row.uncostedDays > 0) {
    // Rates are never negative, so a partial sum is a true lower bound — the
    // mark needs no legend and cannot lie.
    return {
      text: `≥ ${formatMoney(row.cost)}`,
      title: uncostedNote(row.uncostedDays),
      derived: false,
    };
  }
  return { text: formatMoney(row.cost), title: null, derived: false };
}

/**
 * Why a figure is only a lower bound. One wording for the two hovers — a
 * partial cost cell's and the status-bar total's — about the same effort, so a
 * reader who meets both does not have to tell them apart. Beside the total the
 * status bar also states it visibly and shorter (`StatusBar.tsx`), where a
 * full sentence has no room.
 */
export function uncostedNote(days: number): string {
  return `${formatDays(days)} d of effort not costed`;
}

/**
 * The unit a rate or a cost is in, said in the label — never in the cell,
 * which stays a bare number. One home for the parenthesis form: every surface
 * that labels a figure calls this, and none re-spells the parentheses.
 */
export function currencyLabel(base: 'Rate' | 'Cost', currency: string | null): string {
  return currency ? `${base} (${currency})` : base;
}
