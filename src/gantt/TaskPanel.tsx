import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import type { Resource, ShareOverride } from '../scheduler';
import { ColorSwatches } from './ColorSwatches';
import { costCellText, currencyLabel, rateCellText } from './costCells';
import { formatDay, formatDays } from './format';
import type { TaskDetails, TaskPatch } from './ganttHandle';
import { PercentCell, PeriodRowList } from './PeriodRowList';
import { CRITICAL_CHAIN_LIMIT, endsBeforeStart, type MeasuredSlack } from './project';
import { DESCRIPTION_LIMIT } from './serialization';
import { hasShare, parseTaskShare, type DatedSharePeriod } from './taskShare';

/** The fields a change writes; the caller adds the rest of the task as it stands. */
export type TaskEdit = Partial<TaskPatch>;

const pad = (value: number) => String(value).padStart(2, '0');
const toDayInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
/** Empty = not fixed. Trimmed of float noise: 0.07 is 7, not 7.000000000000001. */
const toPercentInput = (share: number | undefined) =>
  share === undefined ? '' : String(Number((share * 100).toFixed(4)));
/** A day typed in full: a date input reports year 2, 20 and 202 on the way to 2026. */
const typedDay = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return year >= 1000 && month && day ? { year, month, day } : null;
};

/**
 * A text-like field that shows the task while not being edited and writes on
 * leaving it (or Enter): one change, one undo step, not one per keystroke.
 * `write` answers whether the value was taken; a refused one reverts.
 */
function useLiveField(source: string, write: (value: string) => boolean) {
  const [draft, setDraft] = useState<string | null>(null);
  const settle = () => {
    if (draft !== null && draft !== source) write(draft);
    setDraft(null);
  };
  return {
    value: draft ?? source,
    onFocus: () => setDraft(source),
    onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
    onBlur: settle,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' && !(event.target instanceof HTMLTextAreaElement)) {
        (event.target as HTMLElement).blur();
      } else if (event.key === 'Escape') {
        // Takes the edit back; the panel itself stays open.
        event.stopPropagation();
        setDraft(null);
        setTimeout(() => (event.target as HTMLElement).blur());
      }
    },
  };
}

/**
 * The task's details beside the chart: every change applies at once, through
 * the same `updateTask` as any other edit, so undo takes each one back.
 * Keyed by task: a new task starts with no field half-edited.
 */
export function TaskPanel({
  task,
  focusPace,
  pacePeriods,
  paceDays,
  newPacePeriod,
  slack,
  resources,
  workingDays,
  colors,
  onEdit,
  onToggleAutoEnd,
  onClose,
  onDelete,
}: {
  task: TaskDetails;
  /** Bumped when a pace period was just added from the chart: focuses its percent. */
  focusPace?: number;
  /** The task's periods on the dates the plan puts them now. */
  pacePeriods: DatedSharePeriod[];
  /** Those rows back as days of the task, against the same plan; throws what is refused. */
  paceDays(periods: DatedSharePeriod[]): ShareOverride[];
  /** The period a new row starts as on `day`: one day, at the share the task already runs at. */
  newPacePeriod(day: string): DatedSharePeriod;
  /** Null when the plan is past the size the app will measure. */
  slack: MeasuredSlack | null;
  resources: Resource[];
  /** The calendar's working weekdays, for the day count beside a pace period. */
  workingDays: number[];
  colors: { key: string; label: string }[];
  /** Applies a change; answers the refusal, if any. */
  onEdit(edit: TaskEdit): string | null;
  /** Off fixes the end at the start plus the effort; on hands the end back to the engine. */
  onToggleAutoEnd(): void;
  onClose(): void;
  onDelete(): void;
}) {
  const [error, setError] = useState<string | null>(null);
  const write = (edit: TaskEdit): boolean => {
    const refusal = onEdit(edit);
    setError(refusal);
    return refusal === null;
  };
  const refuse = (message: string) => {
    setError(message);
    return false;
  };

  const fixed = !task.isSummary && Boolean(task.fixedEnd);
  const isMilestone = !task.isSummary && !fixed && task.nominalDays === 0;
  /** Only work can be paced: not a summary, which is never scheduled, nor an instant. */
  const paced = !task.isSummary && !isMilestone;

  const name = useLiveField(task.name, (value) =>
    value.trim() ? write({ name: value.trim() }) : refuse('Name cannot be empty'),
  );
  const effort = useLiveField(String(task.nominalDays), (value) => {
    const days = Number(value);
    return value.trim() !== '' && Number.isFinite(days) && days >= 0
      ? write({ nominalDays: days })
      : refuse('Effort must be a non-negative number of days');
  });
  const progress = useLiveField(String(Math.round(task.progress * 100)), (value) => {
    const percentage = Number(value);
    return value.trim() !== '' && Number.isFinite(percentage) && percentage >= 0 && percentage <= 100
      ? write({ progress: percentage / 100 })
      : refuse('Progress must be between 0 and 100');
  });
  const description = useLiveField(task.description ?? '', (value) => {
    // Whitespace-only reads as empty (deletes the stored text); otherwise the
    // value goes through verbatim — a description with content is not trimmed.
    const text = value.trim() === '' ? '' : value;
    return text.length > DESCRIPTION_LIMIT
      ? refuse(`Description: ${text.length} characters, the limit is ${DESCRIPTION_LIMIT}`)
      : write({ description: text });
  });
  const sharePercent = useLiveField(toPercentInput(task.share), (value) => {
    const typed = value.trim();
    try {
      // The file's gate, so the panel cannot store what Save would refuse.
      const pace = parseTaskShare(
        typed !== '' ? Number(typed) / 100 : undefined,
        task.shareOverrides,
        fixed,
      );
      return write({ share: pace.share ?? null });
    } catch (problem) {
      return refuse((problem as Error).message);
    }
  });

  const writeStart = (value: string) => {
    const day = typedDay(value);
    if (!day) return;
    // Keeps the time of day the engine assigned: only the calendar day is edited
    // here, and a start at midnight would sit outside the working window.
    const start = new Date(day.year, day.month - 1, day.day, task.start.getHours(), task.start.getMinutes());
    if (fixed && endsBeforeStart(start, task.end)) refuse('The end cannot come before the start');
    else write({ start });
  };
  const writeEnd = (value: string) => {
    const day = typedDay(value);
    if (!day) return;
    const end = new Date(day.year, day.month - 1, day.day);
    if (endsBeforeStart(task.start, end)) refuse('The end cannot come before the start');
    else write({ fixedEnd: end });
  };

  // Rows being edited stay local until the pointer or the focus leaves the
  // section, so a percent typed digit by digit is one change, not three.
  const [periodsDraft, setPeriodsDraft] = useState<DatedSharePeriod[] | null>(null);
  const periods = periodsDraft ?? pacePeriods;
  const writePeriods = (next: DatedSharePeriod[]) => {
    try {
      const pace = parseTaskShare(task.share, paceDays(next), fixed);
      if (write({ shareOverrides: pace.shareOverrides ?? [] })) setPeriodsDraft(null);
    } catch (problem) {
      refuse((problem as Error).message);
    }
  };
  const onPeriodsChange = (next: DatedSharePeriod[]) => {
    // A row added or removed is a whole gesture already.
    if (next.length !== periods.length) writePeriods(next);
    else setPeriodsDraft(next);
  };
  const leavePace = (event: FocusEvent<HTMLDivElement>) => {
    if (periodsDraft && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
      writePeriods(periodsDraft);
    }
  };

  const paceSection = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusPace) return;
    const seeded = [
      ...(paceSection.current?.querySelectorAll<HTMLInputElement>('.ranges__row .ranges__pct') ?? []),
    ].at(-1);
    seeded?.scrollIntoView({ block: 'center' });
    seeded?.focus();
    seeded?.select();
  }, [focusPace]);

  const fromChildren = (
    <span className="taskinfo__derived taskinfo__derived--cell">from subtasks</span>
  );
  const contendedWith = resources.find(
    (resource) => resource.id === slack?.contendedResourceId,
  )?.name;
  /** Contention explains the criticality, so it is that note's to say. */
  const namesContention = Boolean(slack?.isCritical && contendedWith);
  /** Reads on from either opening, so it starts lower case. */
  const whatCostsWhat = slack?.floatDays
    ? `can start up to ${formatDays(slack.floatDays)} d later, but one more day of work moves the project end`
    : 'any delay here moves the project end';

  // Both entries read the solve, like every other figure in the Computed block.
  const rateCell = rateCellText({
    dailyRates: task.dailyRates,
    isSummary: task.isSummary,
    isMilestone,
  });
  const costCell = costCellText({
    effortDays: task.effortDays,
    cost: task.cost,
    uncostedDays: task.uncostedDays,
    resourceName: resources.find((resource) => resource.id === task.resourceId)?.name ?? null,
    isSummary: task.isSummary,
  });

  return (
    <aside className="taskpanel" aria-label="Task details">
      <header className="taskpanel__header">
        <h2 className="taskpanel__title">
          {task.isSummary ? 'Summary task' : isMilestone ? 'Milestone' : 'Task detail'}
        </h2>
        <button type="button" className="taskpanel__close" title="Close" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </button>
      </header>
      {error && (
        <p className="dialog__error" role="alert" key={error}>
          {error}
        </p>
      )}

      <div className="taskpanel__body">
        <div className="taskinfo__grid">
          <label className="taskinfo__field taskinfo__field--wide">
            <span className="taskinfo__label">Name</span>
            <input className="dialog__control" {...name} />
          </label>

          <label className="taskinfo__field">
            <span className="taskinfo__label">Resource</span>
            {task.isSummary ? (
              fromChildren
            ) : (
              <select
                className="dialog__control"
                value={task.resourceId}
                onChange={(event) => write({ resourceId: event.target.value || undefined })}
              >
                <option value="">&mdash;</option>
                {resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="taskinfo__field">
            <span className="taskinfo__label">
              Effort
              {/* The only way to make a milestone, so the field has to say so. */}
              {!task.isSummary && (
                <span className="taskinfo__hint">{fixed ? ' · unused, end fixed' : ' · 0 = milestone'}</span>
              )}
            </span>
            {task.isSummary ? (
              fromChildren
            ) : (
              <span className="dialog__field">
                <input
                  className="dialog__control taskinfo__amount"
                  type="number"
                  min={0}
                  max={999}
                  step={0.25}
                  {...effort}
                />
                <span className="dialog__suffix">days</span>
              </span>
            )}
          </label>

          <label className="taskinfo__field">
            <span className="taskinfo__label">Start</span>
            {task.isSummary ? (
              fromChildren
            ) : (
              <input
                className="dialog__control"
                type="date"
                key={`start-${toDayInput(task.start)}`}
                defaultValue={toDayInput(task.start)}
                onChange={(event) => writeStart(event.target.value)}
              />
            )}
          </label>

          <div className="taskinfo__field">
            <span className="taskinfo__label">End</span>
            {task.isSummary ? (
              fromChildren
            ) : fixed ? (
              <input
                className="dialog__control"
                type="date"
                aria-label="Fixed end"
                key={`end-${toDayInput(task.end)}`}
                defaultValue={toDayInput(task.end)}
                onChange={(event) => writeEnd(event.target.value)}
              />
            ) : (
              <span className="taskinfo__derived taskinfo__derived--cell">{formatDay(task.end)}</span>
            )}
          </div>

          {!task.isSummary && (
            <label className="taskinfo__field taskinfo__field--wide">
              <span className="taskinfo__checkbox">
                <input type="checkbox" checked={!fixed} onChange={onToggleAutoEnd} />
                Auto end
                <span className="taskinfo__hint">
                  {fixed ? 'off: end fixed, effort = the work that fits' : 'follows effort and share'}
                </span>
              </span>
            </label>
          )}

          <label className="taskinfo__field">
            <span className="taskinfo__label">Progress</span>
            <span className="dialog__field">
              <input
                className="dialog__control taskinfo__amount"
                type="number"
                min={0}
                max={100}
                step={5}
                {...progress}
              />
              <span className="dialog__suffix">%</span>
            </span>
          </label>

          <div className="taskinfo__field taskinfo__field--wide">
            <span className="taskinfo__label">Colour</span>
            {task.ownsColor ? (
              <ColorSwatches
                value={task.color ?? ''}
                auto={task.autoColor}
                autoTitle="No colour of its own: its person's when it has one alone, else the default"
                colors={colors}
                onChange={(color) => write({ color: color || undefined })}
              />
            ) : (
              <span className="taskinfo__derived taskinfo__derived--cell">
                follows its top-level task, or its person where that has none
              </span>
            )}
          </div>

          {paced && (
            <div
              className="taskinfo__field taskinfo__field--wide taskinfo__pace"
              ref={paceSection}
              onBlur={leavePace}
            >
              <span className="taskinfo__label">Pace</span>
              <span className="taskinfo__checkbox">
                <span className="dialog__field people__field">
                  <input
                    className="dialog__control ranges__pct taskinfo__pace-default"
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    aria-label="Default share"
                    {...sharePercent}
                  />
                  <span className="dialog__suffix">%</span>
                </span>
                by default (empty: not fixed{fixed ? '; 0: weighs on nobody' : ''})
              </span>
              <PeriodRowList<DatedSharePeriod>
                periods={periods}
                workingWeekdays={workingDays}
                emptyMessage="No periods: the pace above holds for the whole task."
                newPeriod={newPacePeriod}
                labelPlaceholder={(period) => (period.share === 0 ? 'Pause' : 'Reason')}
                countSuffix={(period) => (period.share === 0 ? ' paused' : '')}
                overlapRefused
                valueCell={(period, update) => (
                  <PercentCell value={period.share} onChange={(share) => update({ share })} />
                )}
                onChange={onPeriodsChange}
              />
              <span className="taskinfo__hint">
                The exact share of the person's capacity the task runs at; 0% pauses it. A period is
                days of the task, shown on the dates the plan gives them now: it moves with the task.
              </span>
            </div>
          )}

          <label className="taskinfo__field taskinfo__field--wide">
            <span className="taskinfo__label">Description</span>
            <textarea className="dialog__control taskinfo__description" rows={3} {...description} />
          </label>

          <label className="taskinfo__field taskinfo__field--wide">
            <span className="taskinfo__checkbox">
              <input
                type="checkbox"
                checked={task.disabled}
                onChange={(event) => write({ disabled: event.target.checked })}
              />
              Disabled
              <span className="taskinfo__hint">
                stays on the plan but does not weigh: no capacity, out of roll-up and critical chain
              </span>
            </span>
          </label>
        </div>

        <section className="taskinfo__computed">
          <h3 className="dialog__subhead">Computed</h3>
          <p className="dialog__hint">
            {fixed ? (
              <>
                The <strong>start</strong> and the <strong>end</strong> are fixed: the engine neither
                moves nor stretches this task, and no dependency holds it. It still takes its share of
                the resource meanwhile, and its effort is the work that went in. Clearing the end
                hands it back to the engine.
              </>
            ) : isMilestone ? (
              <>
                Effort <strong>0</strong>: a milestone, that is a date the plan reaches rather than
                work it consumes. It occupies nobody and is a diamond on the chart. Setting an effort
                above zero turns it back into a task.
              </>
            ) : (
              <>
                The <strong>end</strong> and the <strong>duration</strong> are not set directly: the
                engine computes them from effort, start, calendar and the share of the resource the
                task receives.
              </>
            )}
          </p>

          <dl className="taskinfo__readonly">
            <div>
              <dt>End</dt>
              <dd>{formatDay(task.end)}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd className={task.shared ? 'gantt-stretched' : undefined}>
                {formatDays(task.elapsedDays)} d
              </dd>
            </div>
            <div>
              <dt>Total effort</dt>
              <dd>{formatDays(task.effortDays)} d</dd>
            </div>
            <div>
              {/* The figure, whatever else is true of the task: criticality is a
                  different fact and it is stated below, in words. */}
              <dt>Float</dt>
              <dd className={slack?.isCritical ? 'taskinfo__critical' : undefined}>
                {slack === null ? (
                  <span className="taskinfo__derived">&mdash;</span>
                ) : (
                  `${formatDays(slack.floatDays)} d`
                )}
              </dd>
            </div>
            <div>
              <dt>{currencyLabel('Rate', task.currency)}</dt>
              <dd title={rateCell.title ?? undefined}>
                {rateCell.derived ? <span className="taskinfo__derived">{rateCell.text}</span> : rateCell.text}
              </dd>
            </div>
            <div>
              <dt>{currencyLabel('Cost', task.currency)}</dt>
              <dd title={costCell.title ?? undefined}>
                {costCell.derived ? <span className="taskinfo__derived">{costCell.text}</span> : costCell.text}
              </dd>
            </div>
          </dl>
          <div className="taskinfo__notes">
            {/* Contention is said once: where the criticality note below names the
                person, this would be the second sentence about the same fact. */}
            {task.contended
              ? !namesContention && (
                  <p className="taskinfo__note">
                    The resource is split with other tasks in progress, so the duration exceeds the
                    effort.
                  </p>
                )
              : hasShare(task)
                ? task.elapsedDays > task.effortDays && (
                    <p className="taskinfo__note">Held to its fixed share, so the duration exceeds the effort.</p>
                  )
                : task.shared && (
                    <p className="taskinfo__note">
                      The resource does not work full time in this period, so the duration exceeds the
                      effort.
                    </p>
                  )}
            {fixed ? (
              <p className="taskinfo__note">Fixed dates have no float: it can neither slip nor grow.</p>
            ) : slack === null ? (
              <p className="taskinfo__note">
                Past {CRITICAL_CHAIN_LIMIT} tasks the float is not measured: it costs a re-solve of the
                plan for every day probed. Ask for the critical chain from the status bar.
              </p>
            ) : slack.isCritical ? (
              <p className="taskinfo__note">
                <strong>Critical{namesContention ? ` — contended on ${contendedWith}` : ''}.</strong>{' '}
                {namesContention
                  ? `Its share is split with other tasks in progress: ${whatCostsWhat}.`
                  : `${whatCostsWhat[0].toUpperCase()}${whatCostsWhat.slice(1)}.`}
              </p>
            ) : (
              <p className="taskinfo__note">
                Can slip up to {formatDays(slack.floatDays)} d without moving the project end.
              </p>
            )}
          </div>
        </section>
      </div>

      <footer className="taskpanel__footer">
        <button type="button" className="dialog__btn dialog__btn--danger" onClick={onDelete}>
          Delete
        </button>
      </footer>
    </aside>
  );
}
