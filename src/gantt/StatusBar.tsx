import type { MouseEvent, Ref } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ChartNoAxesColumn,
  CalendarCheck,
  Columns3,
  Maximize2,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from 'lucide-react';
import { CRITICAL_CHAIN_LIMIT, type ChainState } from './project';
import { uncostedNote } from './costCells';
import { formatDays, formatMoney } from './format';

export interface StatusBarProps {
  taskCount: number;
  /**
   * The plan's total, or null when nothing in it was costed — which is what the
   * footer then shows: nothing.
   */
  cost: { totalCost: number; uncostedDays: number; currency: string | null } | null;
  /** Label of the active zoom level, already localised by the chart. */
  scale: string;
  /** What the chart is showing of the critical chain, which decides what the control offers. */
  chainState: ChainState;
  /** Whether the per-person load lanes are open under the chart. */
  loadShown: boolean;
  /** Whether the task grid is collapsed to zero width, to render the toggle pressed. */
  gridCollapsed: boolean;
  /** Whether the column picker popover is open, to render its button pressed. */
  columnPickerOpen: boolean;
  /** What is being looked for, owned by App because the matches are. */
  search: string;
  matchCount: number;
  /** Which match the chart is on, 1-based, or 0 when it is on none of them. */
  matchPosition: number;
  /** So Ctrl+F can put the caret here, from App where every shortcut lives. */
  searchFieldRef?: Ref<HTMLInputElement>;
  onSearch(query: string): void;
  /** +1 for the next match, -1 for the previous. Rings round at either end. */
  onStepMatch(step: number): void;
  onCollapseAll(): void;
  onExpandAll(): void;
  onToggleGridCollapsed(): void;
  onOpenColumnPicker(event: MouseEvent<HTMLButtonElement>): void;
  onCriticalChain(): void;
  onToggleLoad(): void;
  onToday(): void;
  onZoomIn(): void;
  onZoomOut(): void;
  onZoomToFit(): void;
}

/**
 * One control, and the label always says what the click does.
 *
 * A current answer is there to be hidden; anything else is there to be asked
 * for. Past the limit nothing measures on its own, so the wording changes from
 * a switch to a request — and once an edit has outdated the answer, to a
 * request to do it again.
 */
const CHAIN_LABEL: Record<ChainState, string> = {
  off: 'Critical chain',
  live: 'Critical chain',
  fresh: 'Critical chain',
  asked: 'Compute critical chain',
  stale: 'Recompute critical chain',
};

const CHAIN_TITLE: Record<ChainState, string> = {
  off: 'Highlight the tasks the end date depends on',
  live: 'Stop highlighting critical tasks',
  fresh: `Computed on request: past ${CRITICAL_CHAIN_LIMIT} tasks it does not update on its own`,
  asked: `Past ${CRITICAL_CHAIN_LIMIT} tasks it is computed on request: it costs a re-solve of the plan per task`,
  stale: 'The plan changed after the measurement: the dashed outline is the earlier marking',
};

/** Drawn on the chart, so the control shows itself as pressed. */
const CHAIN_SHOWN: Record<ChainState, boolean> = {
  off: false,
  live: true,
  fresh: true,
  asked: false,
  stale: true,
};

export function StatusBar({
  taskCount,
  cost,
  scale,
  chainState,
  loadShown,
  gridCollapsed,
  columnPickerOpen,
  search,
  matchCount,
  matchPosition,
  searchFieldRef,
  onSearch,
  onStepMatch,
  onCollapseAll,
  onExpandAll,
  onToggleGridCollapsed,
  onOpenColumnPicker,
  onCriticalChain,
  onToggleLoad,
  onToday,
  onZoomIn,
  onZoomOut,
  onZoomToFit,
}: StatusBarProps) {
  return (
    <footer className="statusbar">
      <span>{taskCount} tasks</span>
      {cost && (
        <span
          className="statusbar__cost"
          title={cost.uncostedDays > 0 ? uncostedNote(cost.uncostedDays) : undefined}
        >
          Cost {cost.uncostedDays > 0 ? '≥ ' : ''}
          {formatMoney(cost.totalCost)}
          {cost.currency ? ` ${cost.currency}` : ''}
          {cost.uncostedDays > 0 ? ` · ${formatDays(cost.uncostedDays)} d not costed` : ''}
        </span>
      )}
      {/* Nothing is filtered, so this is a way through the plan and belongs with
          the other controls over the view rather than with the file actions. */}
      <div className="statusbar__search">
        <input
          ref={searchFieldRef}
          type="search"
          className="statusbar__searchfield"
          value={search}
          placeholder="Search tasks"
          // The field carries no visible text of its own, so this is its name
          // rather than a second one competing with a label.
          aria-label="Search tasks"
          onChange={(event) => onSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onStepMatch(event.shiftKey ? -1 : 1);
            } else if (event.key === 'Escape') {
              // Its own field, so this cannot reach anything else — and there
              // is nothing to leave behind, the plan never having been filtered.
              event.stopPropagation();
              onSearch('');
            }
          }}
        />
        {search !== '' && (
          <>
            {/* Read out on its own, because on a long plan the answer to a
                query is often that there is nothing to walk to. */}
            <span className="statusbar__matches" role="status">
              {matchCount === 0 ? 'none' : `${matchPosition}/${matchCount}`}
            </span>
            {/* Greyed rather than removed, as the undo arrows are: a control
                that comes and goes moves everything beside it. */}
            <button
              type="button"
              className="statusbar__step"
              disabled={matchCount === 0}
              aria-label="Previous match"
              title="Previous match (Shift+Enter)"
              onClick={() => onStepMatch(-1)}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className="statusbar__step"
              disabled={matchCount === 0}
              aria-label="Next match"
              title="Next match (Enter)"
              onClick={() => onStepMatch(1)}
            >
              <ChevronRight size={14} />
            </button>
          </>
        )}
      </div>
      {/* What the grid shows and whether it shows at all, beside what its rows
          are folded to: every one of them is a setting of the view, and none
          of them touches the plan. They used to sit at the far end of the
          toolbar, among the file and model actions. */}
      <div className="statusbar__rows">
        <button type="button" onClick={onCollapseAll} title="Collapse all tasks">
          <ChevronsDownUp size={14} />
          Collapse
        </button>
        <button type="button" onClick={onExpandAll} title="Expand all tasks">
          <ChevronsUpDown size={14} />
          Expand
        </button>
        <button
          type="button"
          className={'statusbar__view' + (gridCollapsed ? ' statusbar__view--on' : '')}
          onClick={onToggleGridCollapsed}
          aria-pressed={gridCollapsed}
          aria-label={gridCollapsed ? 'Show the task grid' : 'Hide the task grid'}
          title={gridCollapsed ? 'Show the task grid' : 'Hide the task grid, for the chart alone'}
        >
          {gridCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
        <button
          type="button"
          className={'statusbar__view' + (columnPickerOpen ? ' statusbar__view--on' : '')}
          onClick={onOpenColumnPicker}
          aria-pressed={columnPickerOpen}
          aria-label="Choose grid columns"
          title="Choose which columns the grid shows"
        >
          <Columns3 size={14} />
        </button>
      </div>
      {/* Never disabled: a control that is dead reads as broken, and past the
          limit there is something to offer — the measurement itself. */}
      <button
        type="button"
        className={
          'statusbar__critical' +
          (CHAIN_SHOWN[chainState] ? ' statusbar__critical--on' : '') +
          (chainState === 'stale' ? ' statusbar__critical--old' : '')
        }
        aria-pressed={CHAIN_SHOWN[chainState]}
        title={CHAIN_TITLE[chainState]}
        onClick={onCriticalChain}
      >
        {CHAIN_LABEL[chainState]}
      </button>
      {/* Beside the critical chain, and not with the zoom: both answer a question
          about the plan rather than about the view of it. */}
      <button
        type="button"
        className={'statusbar__load' + (loadShown ? ' statusbar__load--on' : '')}
        aria-pressed={loadShown}
        title="Shows how busy each person is and where they still have capacity"
        onClick={onToggleLoad}
      >
        <ChartNoAxesColumn size={14} />
        Resource load
      </button>
      <span className="statusbar__spacer" />
      <button type="button" onClick={onToday}>
        <CalendarCheck size={14} />
        Today
      </button>
      <span className="statusbar__scale">
        Scale: <strong>{scale}</strong>
      </span>
      {/* Named, like every other icon-only button here: a `title` is the
          accessible name where there is no text at all. */}
      <div className="statusbar__zoom">
        <button type="button" onClick={onZoomOut} aria-label="Zoom out" title="Zoom out">
          <Minus size={14} />
        </button>
        <button type="button" onClick={onZoomIn} aria-label="Zoom in" title="Zoom in">
          <Plus size={14} />
        </button>
      </div>
      <button type="button" onClick={onZoomToFit}>
        <Maximize2 size={14} />
        Fit
      </button>
      {/* An agent reads the page text and the accessibility tree before it reads
          anything else, so the scripting surface has to be named there — but it
          is a pointer for a script, not a control, so it sits past the last of
          them rather than between two. */}
      <span className="statusbar__agent">
        For agents: <code>window.arrogantt.help()</code>
      </span>
    </footer>
  );
}
