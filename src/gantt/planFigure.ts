import { dateOfDay, dayIndexOf } from '../scheduler';
import { DEFAULT_BAR_COLOR, shade } from './colors';
import { PLAN_COLUMNS, type PlanColumnName } from './columns';
import { costCellText, rateCellText } from './costCells';
import { parseWallClock } from './dates';
import { formatDays } from './format';
import { buildPlan, type PlanTask } from './plan';
import { effectiveColorOf, type Project, type SolvedProject } from './project';

/**
 * The whole plan as one self-contained SVG, drawn from the schedule rather than
 * from the DOM.
 *
 * Rasterising the live chart is not an option: dhtmlx keeps only the rows in
 * view in the DOM and the data area is a scrolling viewport, so a picture of it
 * is a screenful of a plan rather than the plan. This draws every row at
 * whatever height that takes, which is what makes it printable as well.
 *
 * Self-contained means no CSS variables and no external stylesheet: the markup
 * is handed to an `<img>` to rasterise, where the page's rules no longer apply.
 * Every colour is therefore a literal from the app's own palette.
 *
 * The instants are the ones the plan carries, so a milestone lands on the same
 * side of the day boundary its diamond sits on in the chart.
 */

export interface FigureOptions {
  /** Total width in px. The timeline takes what the two label columns leave. */
  width?: number;
  /** Printed top left, the filename in practice. */
  title?: string;
  /** Drawn when it falls inside the plan, as the chart's today line is. */
  today?: Date;
  /**
   * The rows to draw, when a page holds only some of them.
   *
   * The axis is always measured over the whole plan, so every page of the same
   * figure shares one time scale and the bars line up from one to the next.
   */
  slice?: { from: number; count: number };
  /**
   * The plan columns to draw between the name column and the timeline, in
   * registry order. Absent = the legacy Name + Person outline.
   */
  columns?: PlanColumnName[];
  /**
   * The branches the user has closed. Their descendants are not drawn, at any
   * depth; the summary itself is. Absent = every row, as before.
   */
  collapsedIds?: ReadonlySet<string>;
  /** Disabled rows are not drawn. Absent = every row, as before. */
  excludeDisabled?: boolean;
}

export interface Figure {
  svg: string;
  width: number;
  height: number;
}

const PADDING = 16;
const TITLE_HEIGHT = 26;
const MONTH_BAND = 18;
const TICK_BAND = 18;
/** The band of column labels above the month band, drawn only when a column is chosen. */
const HEADER_BAND = 18;
const ROW_HEIGHT = 24;
const NAME_WIDTH = 250;
const PERSON_WIDTH = 110;
const INDENT = 12;
const BAR_HEIGHT = 12;
const SUMMARY_HEIGHT = 8;
const MILESTONE_SIZE = 11;
/** Enough for 12px system text: a label is truncated rather than left to overlap. */
const CHAR_WIDTH = 6.4;

const INK = '#1f2430';
const INK_MUTED = '#6b7280';
const INK_FAINT = '#99a0ab';
const LINE = '#edeef1';
const LINE_STRONG = '#dfe2e8';
const NON_WORKING = '#f5f6f9';
const SUMMARY_COLOR = '#55637a';
const TODAY = '#3b6fe0';

/** Deterministic rather than `toLocaleString`, which depends on the ICU data present. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(text: string, available: number): string {
  const fits = Math.floor(available / CHAR_WIDTH);
  if (fits <= 0) return '';
  return text.length <= fits ? text : `${text.slice(0, Math.max(1, fits - 1))}…`;
}

/** Two decimals at most, so the markup stays readable while diffing it. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthLabel(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** `DD/MM/YYYY`, as the CSV writes it and the dialogs show it. */
function formatDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * The tick spacing, chosen so the labels stay apart.
 *
 * A day column narrower than 18px cannot hold two digits and a week narrower
 * than 30px cannot hold a date, so below that only the months are drawn — the
 * same ladder the chart's zoom climbs.
 */
export function tickUnit(pxPerDay: number): 'day' | 'week' | 'month' {
  if (pxPerDay >= 18) return 'day';
  if (pxPerDay >= 30 / 7) return 'week';
  return 'month';
}

interface Geometry {
  firstDay: number;
  lastDay: number;
  pxPerDay: number;
  left: number;
  right: number;
  x(date: Date): number;
}

function geometryOf(from: Date, to: Date, width: number, labelWidth: number): Geometry {
  const firstDay = dayIndexOf(from);
  // Inclusive of the closing day, or a plan ending on a Friday would run out of
  // axis at Thursday midnight and lose its last bar.
  const lastDay = Math.max(dayIndexOf(to), firstDay);
  const left = PADDING + NAME_WIDTH + labelWidth;
  const pxPerDay = (width - PADDING - left) / (lastDay - firstDay + 1);
  return {
    firstDay,
    lastDay,
    pxPerDay,
    left,
    right: left + (lastDay - firstDay + 1) * pxPerDay,
    x(date) {
      // The time of day is the offset inside the column, which is what puts an
      // 08:00 start and a 17:00 finish where the chart puts them.
      const fraction = (date.getHours() * 60 + date.getMinutes()) / (24 * 60);
      return left + (dayIndexOf(date) - firstDay + fraction) * pxPerDay;
    },
  };
}

/**
 * The rows a closed branch hides, at any depth.
 *
 * `buildPlan` orders a parent before its own subtree, so one forward pass is
 * enough: a task is hidden as soon as its parent is either collapsed or
 * already found hidden, with no need to walk back up the chain of ancestors
 * for every row.
 */
function visibleTasks(
  tasks: PlanTask[],
  collapsedIds: ReadonlySet<string> | undefined,
  excludeDisabled: boolean | undefined,
): PlanTask[] {
  if (!collapsedIds && !excludeDisabled) return tasks;
  const hidden = new Set<string>();
  return tasks.filter((task) => {
    // `disabled` is already inherited down the whole branch (`plan.ts`), so a
    // flat check is enough — no ancestor walk needed, unlike `collapsedIds`.
    const parentHidden = task.parentId !== null && (collapsedIds?.has(task.parentId) || hidden.has(task.parentId));
    const hide = parentHidden || (excludeDisabled === true && task.disabled);
    if (hide) hidden.add(task.id);
    return !hide;
  });
}

function isMilestone(task: PlanTask): boolean {
  // Never `start === end`, which a summary holding a single milestone satisfies
  // too — and that one is a bracket over a row, not a date.
  return task.effortDays === 0 && !task.isSummary;
}

/** One cell's plain text; the drawing loop truncates and escapes it. */
type FigureCell = (task: PlanTask, ctx: { names: ReadonlyMap<string, string> }) => string;

/**
 * One renderer per registry entry, keyed exhaustively — the figure-side twin
 * of `GRID_CELLS` in `gridColumns.ts`, minus the HTML: the figure draws plain
 * `<text>`, with no hover and no register class.
 */
const FIGURE_CELLS: Record<PlanColumnName, FigureCell> = {
  resource_id: (task, ctx) =>
    task.resourceId ? ctx.names.get(task.resourceId) ?? task.resourceId : '',
  nominal_days: (task) => `${formatDays(task.effortDays)}d`,
  start_date: (task) => {
    const date = parseWallClock(task.start);
    return date ? formatDay(date) : '';
  },
  end_shown: (task) => {
    const date = parseWallClock(task.end);
    return date ? formatDay(date) : '';
  },
  elapsed_days: (task) => `${formatDays(task.elapsedDays)}d`,
  // The rule that decides a rate or cost cell's text lives in costCells.ts,
  // shared with the grid and the details dialog (F6a/F6b) — never re-derived
  // here.
  rate: (task) =>
    rateCellText({
      dailyRates: task.dailyRates,
      isSummary: task.isSummary,
      isMilestone: isMilestone(task),
    }).text,
  cost: (task, ctx) =>
    costCellText({
      effortDays: task.effortDays,
      cost: task.cost,
      uncostedDays: task.uncostedDays,
      resourceName: task.resourceId ? ctx.names.get(task.resourceId) ?? task.resourceId : null,
      isSummary: task.isSummary,
    }).text,
};

function bar(task: PlanTask, top: number, geometry: Geometry, color: string): string {
  const start = parseWallClock(task.start);
  const end = parseWallClock(task.end);
  if (!start || !end) return '';
  const middle = top + ROW_HEIGHT / 2;

  if (isMilestone(task)) {
    const center = geometry.x(start);
    const half = MILESTONE_SIZE / 2;
    const points = [
      `${round(center)},${round(middle - half)}`,
      `${round(center + half)},${round(middle)}`,
      `${round(center)},${round(middle + half)}`,
      `${round(center - half)},${round(middle)}`,
    ].join(' ');
    return `<polygon points="${points}" fill="${color}" />`;
  }

  const height = task.isSummary ? SUMMARY_HEIGHT : BAR_HEIGHT;
  const left = geometry.x(start);
  // A bar on a plan spanning a year is thinner than a pixel, and one pixel is
  // the least that still reads as a bar rather than as a gap in the row.
  const width = Math.max(1, geometry.x(end) - left);
  return (
    `<rect x="${round(left)}" y="${round(middle - height / 2)}" width="${round(width)}" ` +
    `height="${height}" rx="${height / 2}" fill="${color}" />`
  );
}

/** The colour of the bar, following the chart: a summary takes a flatter shade. */
function colorOf(task: PlanTask, project: Project, solved: SolvedProject): string {
  const own = effectiveColorOf(project.tasks, solved.hierarchy, task.id);
  if (!task.isSummary) return own ?? DEFAULT_BAR_COLOR;
  return own ? shade(own, 0.55) : SUMMARY_COLOR;
}

function timeAxis(geometry: Geometry, top: number, bottom: number): string {
  const parts: string[] = [];
  const { firstDay, lastDay, pxPerDay } = geometry;
  const unit = tickUnit(pxPerDay);

  for (let day = firstDay; day <= lastDay; day++) {
    const date = dateOfDay(day);
    const opensAMonth = date.getDate() === 1;
    if (!opensAMonth && day !== firstDay) continue;
    const left = geometry.left + (day - firstDay) * pxPerDay;
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const closes = geometry.left + (Math.min(dayIndexOf(nextMonth), lastDay + 1) - firstDay) * pxPerDay;
    if (opensAMonth) {
      parts.push(
        `<line x1="${round(left)}" y1="${round(top)}" x2="${round(left)}" y2="${round(bottom)}" ` +
          `stroke="${LINE_STRONG}" />`,
      );
    }
    const label = truncate(monthLabel(date), closes - left - 8);
    if (label) {
      parts.push(
        `<text x="${round(left + 4)}" y="${round(top + 13)}" font-size="11" fill="${INK_MUTED}">` +
          `${escapeXml(label)}</text>`,
      );
    }
  }

  const ticksTop = top + MONTH_BAND;
  parts.push(
    `<line x1="${PADDING}" y1="${round(ticksTop)}" x2="${round(geometry.right)}" ` +
      `y2="${round(ticksTop)}" stroke="${LINE_STRONG}" />`,
  );

  if (unit !== 'month') {
    for (let day = firstDay; day <= lastDay; day++) {
      const date = dateOfDay(day);
      if (unit === 'week' && date.getDay() !== 1) continue;
      const left = geometry.left + (day - firstDay) * pxPerDay;
      parts.push(
        `<text x="${round(left + 3)}" y="${round(ticksTop + 13)}" font-size="10" ` +
          `fill="${INK_FAINT}">${date.getDate()}</text>`,
      );
    }
  }
  return parts.join('');
}

export function planFigure(
  project: Project,
  solved: SolvedProject,
  options: FigureOptions = {},
): Figure {
  const width = options.width ?? 1400;
  const plan = buildPlan(solved);
  const names = new Map(project.resources.map((resource) => [resource.id, resource.name]));
  const filteredTasks = visibleTasks(plan.tasks, options.collapsedIds, options.excludeDisabled);
  const rows = options.slice
    ? filteredTasks.slice(options.slice.from, options.slice.from + options.slice.count)
    : filteredTasks;

  // Absent `columns` is the legacy Name + Person outline, kept byte-identical:
  // `selected` stays null rather than `[]`, which is itself a valid selection
  // — of nothing — and keeps the name column's own width.
  const selected = options.columns
    ? PLAN_COLUMNS.filter((entry) => new Set(options.columns).has(entry.name))
    : null;
  const labelWidth = selected
    ? selected.reduce((total, entry) => total + entry.figureWidth, 0)
    : PERSON_WIDTH;

  // A band with no labels in it is nobody's choice, so an empty list draws
  // none. Extracted once: the height and the drawing below gated separately
  // would leave an empty 18px strip no probe reading labels would catch.
  const hasColumnHeader = options.columns !== undefined && options.columns.length > 0;

  const chartTop = PADDING + (options.title ? TITLE_HEIGHT : 0) + (hasColumnHeader ? HEADER_BAND : 0);
  const rowsTop = chartTop + MONTH_BAND + TICK_BAND;
  const rowsBottom = rowsTop + rows.length * ROW_HEIGHT;
  const height = rowsBottom + PADDING;
  const geometry = geometryOf(
    solved.schedule.projectStart,
    solved.schedule.projectEnd,
    width,
    labelWidth,
  );

  const parts: string[] = [`<rect width="${width}" height="${round(height)}" fill="#fff" />`];

  if (options.title) {
    parts.push(
      `<text x="${PADDING}" y="${PADDING + 14}" font-size="14" font-weight="600" fill="${INK}">` +
        `${escapeXml(options.title)}</text>`,
    );
    const span =
      plan.tasks.length > 0
        ? `${formatDay(solved.schedule.projectStart)} → ${formatDay(solved.schedule.projectEnd)}`
        : 'no tasks';
    parts.push(
      `<text x="${width - PADDING}" y="${PADDING + 14}" font-size="11" fill="${INK_MUTED}" ` +
        `text-anchor="end">${escapeXml(span)}</text>`,
    );
  }

  // The topmost band, above the month band — drawn only when there is at
  // least one column to label in it (`hasColumnHeader`).
  if (hasColumnHeader) {
    const headerTop = PADDING + (options.title ? TITLE_HEIGHT : 0);
    let left = PADDING + NAME_WIDTH;
    for (const entry of selected!) {
      const label = truncate(entry.label(project), entry.figureWidth - 6);
      if (label) {
        parts.push(
          `<text x="${round(left)}" y="${round(headerTop + 13)}" font-size="11" ` +
            `font-weight="600" fill="${INK_MUTED}">${escapeXml(label)}</text>`,
        );
      }
      left += entry.figureWidth;
    }
  }

  if (rows.length > 0) {
    // Behind everything else: the weekends and the shutdowns are the background
    // the bars are read against, as they are in the chart.
    for (let day = geometry.firstDay; day <= geometry.lastDay; day++) {
      if (solved.calendar.isWorkingDate(dateOfDay(day))) continue;
      const left = geometry.left + (day - geometry.firstDay) * geometry.pxPerDay;
      parts.push(
        `<rect x="${round(left)}" y="${round(rowsTop)}" width="${round(geometry.pxPerDay)}" ` +
          `height="${round(rowsBottom - rowsTop)}" fill="${NON_WORKING}" />`,
      );
    }

    parts.push(timeAxis(geometry, chartTop, rowsBottom));

    rows.forEach((task, index) => {
      const top = rowsTop + index * ROW_HEIGHT;
      parts.push(
        `<line x1="${PADDING}" y1="${round(top)}" x2="${round(geometry.right)}" y2="${round(top)}" ` +
          `stroke="${LINE}" />`,
      );
      const nameLeft = PADDING + task.depth * INDENT;
      parts.push(
        `<text x="${round(nameLeft)}" y="${round(top + 16)}" font-size="12" ` +
          `${task.isSummary ? 'font-weight="600" ' : ''}fill="${INK}">` +
          `${escapeXml(truncate(task.name, PADDING + NAME_WIDTH - nameLeft - 6))}</text>`,
      );
      if (selected) {
        let left = PADDING + NAME_WIDTH;
        for (const entry of selected) {
          const text = FIGURE_CELLS[entry.name](task, { names });
          if (text) {
            parts.push(
              `<text x="${round(left)}" y="${round(top + 16)}" font-size="11" ` +
                `fill="${INK_MUTED}">${escapeXml(truncate(text, entry.figureWidth - 6))}</text>`,
            );
          }
          left += entry.figureWidth;
        }
      } else {
        const person = task.resourceId ? names.get(task.resourceId) ?? task.resourceId : '';
        if (person) {
          parts.push(
            `<text x="${PADDING + NAME_WIDTH}" y="${round(top + 16)}" font-size="11" ` +
              `fill="${INK_MUTED}">${escapeXml(truncate(person, PERSON_WIDTH - 6))}</text>`,
          );
        }
      }
      parts.push(bar(task, top, geometry, colorOf(task, project, solved)));
    });

    parts.push(
      `<line x1="${PADDING}" y1="${round(rowsBottom)}" x2="${round(geometry.right)}" ` +
        `y2="${round(rowsBottom)}" stroke="${LINE}" />`,
      `<line x1="${round(geometry.left)}" y1="${round(chartTop)}" x2="${round(geometry.left)}" ` +
        `y2="${round(rowsBottom)}" stroke="${LINE_STRONG}" />`,
    );

    if (options.today) {
      const day = dayIndexOf(options.today);
      if (day >= geometry.firstDay && day <= geometry.lastDay) {
        const left = geometry.x(options.today);
        parts.push(
          `<line x1="${round(left)}" y1="${round(chartTop)}" x2="${round(left)}" ` +
            `y2="${round(rowsBottom)}" stroke="${TODAY}" stroke-width="1.5" />`,
        );
      }
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${round(height)}" ` +
    `viewBox="0 0 ${width} ${round(height)}" font-family="system-ui, sans-serif">` +
    parts.join('') +
    '</svg>';
  return { svg, width, height };
}

/** A4 landscape at 96dpi, less the 10mm margins the print sheet asks for. */
const PAGE_WIDTH = 1050;
/** What is left for rows on such a page once the title and the axis have theirs. */
const PAGE_ROWS = 24;

/**
 * The same figure split into pages of rows.
 *
 * A browser does not break an image over a page boundary: a figure taller than
 * the sheet is cropped rather than continued, and a plan of any size is taller
 * than a sheet. So the rows are paged here, and every page repeats the title and
 * the axis — which is also what makes a page readable on its own.
 */
export function planFigurePages(
  project: Project,
  solved: SolvedProject,
  options: Omit<FigureOptions, 'slice'> & { rowsPerPage?: number } = {},
): Figure[] {
  const total = visibleTasks(buildPlan(solved).tasks, options.collapsedIds, options.excludeDisabled).length;
  const perPage = Math.max(1, options.rowsPerPage ?? PAGE_ROWS);
  const pages = Math.max(1, Math.ceil(total / perPage));
  return Array.from({ length: pages }, (_, index) =>
    planFigure(project, solved, {
      ...options,
      width: options.width ?? PAGE_WIDTH,
      title:
        options.title && pages > 1
          ? `${options.title} — page ${index + 1} of ${pages}`
          : options.title,
      slice: { from: index * perPage, count: perPage },
    }),
  );
}
