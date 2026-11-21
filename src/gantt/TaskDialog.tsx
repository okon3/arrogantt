import { useEffect, useRef, useState } from 'react';
import type { Resource, ShareOverride } from '../scheduler';
import { setAutofocus } from './autofocus';
import { ColorSwatches } from './ColorSwatches';
import { costCellText, currencyLabel, rateCellText } from './costCells';
import { Dialog } from './Dialog';
import { formatDays } from './format';
import type { TaskDetails, TaskPatch } from './ganttHandle';
import { PercentCell, PeriodRowList } from './PeriodRowList';
import { CRITICAL_CHAIN_LIMIT, endsBeforeStart, type MeasuredSlack } from './project';
import { DESCRIPTION_LIMIT } from './serialization';
import { hasShare, parseTaskShare, type DatedSharePeriod } from './taskShare';

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const pad = (value: number) => String(value).padStart(2, '0');
const toDayInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
/** Empty = not fixed. Trimmed of float noise: 0.07 is 7, not 7.000000000000001. */
const toPercentInput = (share: number | undefined) =>
  share === undefined ? '' : String(Number((share * 100).toFixed(4)));

/** Mounted only while open, so the draft initialises from props without an effect. */
export function TaskDialog({
  task,
  paceFrom,
  pacePeriods,
  paceDays,
  newPacePeriod,
  slack,
  resources,
  workingDays,
  colors,
  onCancel,
  onSave,
  onDelete,
}: {
  task: TaskDetails;
  /** Opens with one unsaved pace period on this day, its percent focused. */
  paceFrom?: Date;
  /** The task's periods on the dates the plan put them when the dialog opened. */
  pacePeriods: DatedSharePeriod[];
  /** Those rows back as days of the task, against the same plan; throws what Save shows. */
  paceDays(periods: DatedSharePeriod[]): ShareOverride[];
  /** The period a new row starts as on `day`, or on the task's day nearest to it: one day, at the share the task already runs at. */
  newPacePeriod(day: string): DatedSharePeriod;
  /** Null when the plan is past the size the app will measure. */
  slack: MeasuredSlack | null;
  resources: Resource[];
  /** The calendar's working weekdays, for the day count beside a pace period. */
  workingDays: number[];
  colors: { key: string; label: string }[];
  onCancel(): void;
  onSave(patch: TaskPatch): void;
  onDelete(): void;
}) {
  const [name, setName] = useState(task.name);
  // Kept as text so a half-typed number survives a re-render.
  const [effort, setEffort] = useState(String(task.nominalDays));
  const [start, setStart] = useState(toDayInput(task.start));
  // Empty = the engine decides. The solved end, which on a fixed task is the declared one.
  const [end, setEnd] = useState(task.fixedEnd ? toDayInput(task.end) : '');
  const [resourceId, setResourceId] = useState(task.resourceId);
  const [color, setColor] = useState(task.color ?? '');
  const [progress, setProgress] = useState(String(Math.round(task.progress * 100)));
  const [disabled, setDisabled] = useState(task.disabled);
  const [description, setDescription] = useState(task.description ?? '');
  const [sharePercent, setSharePercent] = useState(toPercentInput(task.share));
  const [sharePeriods, setSharePeriods] = useState<DatedSharePeriod[]>(() => [
    ...pacePeriods,
    ...(paceFrom ? [newPacePeriod(toDayInput(paceFrom))] : []),
  ]);
  const pace = useRef<HTMLDivElement>(null);
  // An effect, not `autofocus`: it runs after Dialog's own `showModal()`, which
  // is what hands the name field the focus this takes over.
  useEffect(() => {
    if (!paceFrom) return;
    const seeded = [...(pace.current?.querySelectorAll<HTMLInputElement>('.ranges__row .ranges__pct') ?? [])].at(-1);
    seeded?.scrollIntoView({ block: 'center' });
    seeded?.focus();
    seeded?.select();
  }, [paceFrom]);
  const [error, setError] = useState<string | null>(null);

  // Read off the field being edited rather than off the task, so the dialog
  // changes register while the zero is typed: that is the whole of what makes
  // "effort 0" and "milestone" one concept rather than two. An empty field is not
  // a zero — `Number('')` is — and would otherwise announce a milestone the user
  // is in the middle of not typing.
  const fixed = !task.isSummary && end !== '';
  const isMilestone =
    !task.isSummary && !fixed && effort.trim() !== '' && Number(effort) === 0;
  /** Only work can be paced: not a summary, which is never scheduled, nor an instant. */
  const paced = !task.isSummary && !isMilestone;

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name cannot be empty');
      return;
    }
    const days = Number(effort);
    if (!Number.isFinite(days) || days < 0) {
      setError('Effort must be a non-negative number of days');
      return;
    }
    const percentage = Number(progress);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      setError('Progress must be between 0 and 100');
      return;
    }
    const [year, month, day] = start.split('-').map(Number);
    if (!year || !month || !day) {
      setError('Invalid start date');
      return;
    }
    // Keeps the time of day the engine assigned: only the calendar day is edited
    // here, and a start at midnight would sit outside the working window.
    const startDate = new Date(year, month - 1, day, task.start.getHours(), task.start.getMinutes());
    const [endYear, endMonth, endDay] = end.split('-').map(Number);
    if (fixed && !(endYear && endMonth && endDay)) {
      setError('Invalid end date');
      return;
    }
    const endDate = fixed ? new Date(endYear, endMonth - 1, endDay) : null;
    if (endDate && endsBeforeStart(startDate, endDate)) {
      setError('The end cannot come before the start');
      return;
    }
    // Whitespace-only reads as empty (deletes the stored text); otherwise the
    // value goes through verbatim — a description with content is not trimmed.
    const descriptionToSave = description.trim() === '' ? '' : description;
    if (descriptionToSave.length > DESCRIPTION_LIMIT) {
      setError(
        `Description: ${descriptionToSave.length} characters, the limit is ${DESCRIPTION_LIMIT}`,
      );
      return;
    }
    // Only while the section is on screen. The default goes back only if it
    // was retyped: the field shows a rounded percentage, and writing that back
    // would change a share nobody touched.
    const shareTyped = sharePercent.trim();
    const shareEdited = paced && shareTyped !== toPercentInput(task.share);
    let pace: ReturnType<typeof parseTaskShare> = {};
    try {
      // The file's gate, so the dialog cannot store what Save would refuse.
      pace = parseTaskShare(
        shareEdited && shareTyped !== '' ? Number(shareTyped) / 100 : undefined,
        paced ? paceDays(sharePeriods) : undefined,
      );
    } catch (problem) {
      setError((problem as Error).message);
      return;
    }
    onSave({
      name: trimmed,
      nominalDays: days,
      start: startDate,
      resourceId: resourceId || undefined,
      color: task.ownsColor ? color || undefined : undefined,
      progress: percentage / 100,
      disabled,
      description: descriptionToSave,
      share: shareEdited ? (pace.share ?? null) : undefined,
      shareOverrides: paced ? (pace.shareOverrides ?? []) : undefined,
      fixedEnd: task.isSummary ? undefined : endDate,
    });
  };

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

  // Both entries read the solve, like every other figure in the Computed
  // block — not the effort field being typed. `isMilestone` here is
  // `project.ts`'s predicate spelled out (`nominalDays === 0 && !summary`),
  // which is what the grid's row `type` is built from, so the two surfaces
  // partition the rows identically by construction.
  const rateCell = rateCellText({
    dailyRates: task.dailyRates,
    isSummary: task.isSummary,
    isMilestone: task.nominalDays === 0 && !task.isSummary && !task.fixedEnd,
  });
  const costCell = costCellText({
    effortDays: task.effortDays,
    cost: task.cost,
    uncostedDays: task.uncostedDays,
    resourceName: resources.find((resource) => resource.id === task.resourceId)?.name ?? null,
    isSummary: task.isSummary,
  });

  return (
    <Dialog
      title={task.isSummary ? 'Summary task' : isMilestone ? 'Milestone' : 'Task detail'}
      width={560}
      className="taskinfo"
      onDismiss={onCancel}
      error={error}
      footer={
        <>
          <button type="button" className="dialog__btn dialog__btn--danger" onClick={onDelete}>
            Delete
          </button>
          <span className="dialog__spacer" />
          <button type="button" className="dialog__btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="dialog__btn dialog__btn--primary" onClick={save}>
            Save
          </button>
        </>
      }
    >
      <div className="taskinfo__grid">
        <label className="taskinfo__field taskinfo__field--wide">
          <span className="taskinfo__label">Name</span>
          <input
            className="dialog__control"
            value={name}
            onChange={(event) => setName(event.target.value)}
            ref={setAutofocus}
          />
        </label>

        <label className="taskinfo__field">
          <span className="taskinfo__label">Resource</span>
          {task.isSummary ? (
            fromChildren
          ) : (
            <select
              className="dialog__control"
              value={resourceId}
              onChange={(event) => setResourceId(event.target.value)}
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
            {/* The only way to make a milestone, so the field has to say so:
                there is no second control, because there is no second concept. */}
            {!task.isSummary && (
              <span className="taskinfo__hint">
                {fixed ? ' · the estimate: unused while the end is fixed' : ' · 0 = milestone'}
              </span>
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
                value={effort}
                onChange={(event) => setEffort(event.target.value)}
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
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          )}
        </label>

        <label className="taskinfo__field">
          <span className="taskinfo__label">
            End
            {!task.isSummary && <span className="taskinfo__hint"> · empty = computed</span>}
          </span>
          {task.isSummary ? (
            fromChildren
          ) : (
            <input
              className="dialog__control"
              type="date"
              aria-label="Fixed end"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          )}
        </label>

        <label className="taskinfo__field">
          <span className="taskinfo__label">Progress</span>
          <span className="dialog__field">
            <input
              className="dialog__control taskinfo__amount"
              type="number"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(event) => setProgress(event.target.value)}
            />
            <span className="dialog__suffix">%</span>
          </span>
        </label>

        <div className="taskinfo__field taskinfo__field--wide">
          <span className="taskinfo__label">Colour</span>
          {task.ownsColor ? (
            <ColorSwatches
              value={color}
              auto={task.autoColor}
              autoTitle="No colour of its own: its person's when it has one alone, else the default"
              colors={colors}
              onChange={setColor}
            />
          ) : (
            <span className="taskinfo__derived taskinfo__derived--cell">
              follows its top-level task, or its person where that has none
            </span>
          )}
        </div>

        {paced && (
          <div className="taskinfo__field taskinfo__field--wide taskinfo__pace" ref={pace}>
            <span className="taskinfo__label">Pace</span>
            {/* The People table's own percent field and the Status row's inline
                layout, reused as they stand: the same 68px box the period rows
                below put their percentage in. */}
            <span className="taskinfo__checkbox">
              <span className="dialog__field people__field">
                <input
                  className="dialog__control ranges__pct taskinfo__pace-default"
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  aria-label="Default share"
                  value={sharePercent}
                  onChange={(event) => setSharePercent(event.target.value)}
                />
                <span className="dialog__suffix">%</span>
              </span>
              by default (empty: not fixed)
            </span>
            <PeriodRowList<DatedSharePeriod>
              periods={sharePeriods}
              workingWeekdays={workingDays}
              emptyMessage="No periods: the pace above holds for the whole task."
              newPeriod={newPacePeriod}
              labelPlaceholder={(period) => (period.share === 0 ? 'Pause' : 'Reason')}
              countSuffix={(period) => (period.share === 0 ? ' paused' : '')}
              overlapRefused
              valueCell={(period, update) => (
                <PercentCell value={period.share} onChange={(share) => update({ share })} />
              )}
              onChange={setSharePeriods}
            />
            <span className="taskinfo__hint">
              The exact share of the person's capacity the task runs at; 0% pauses it. A period is
              days of the task, shown on the dates the plan gives them now: it moves with the task.
            </span>
          </div>
        )}
        <label className="taskinfo__field taskinfo__field--wide">
          <span className="taskinfo__label">Description</span>
          <textarea
            className="dialog__control taskinfo__description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className="taskinfo__field taskinfo__field--wide">
          <span className="taskinfo__checkbox">
            <input
              type="checkbox"
              checked={disabled}
              onChange={(event) => setDisabled(event.target.checked)}
            />
            Disabled
            <span className="taskinfo__hint">
              stays on the plan but does not weigh: no capacity, out of roll-up and critical chain
            </span>
          </span>
        </label>
      </div>

      {/* Closed until asked for: what the engine derived is not what one opens
          this dialog to edit. The two figures asked about most stay in sight. */}
      <details className="taskinfo__computed">
        <summary className="dialog__subhead">
          Computed
          <span className="taskinfo__brief">
            ends {dayFormat.format(task.end)} · {formatDays(task.elapsedDays)} d
          </span>
        </summary>
        <p className="dialog__hint">
          {task.fixedEnd ? (
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
            <dd>{dayFormat.format(task.end)}</dd>
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
              {rateCell.derived ? (
                <span className="taskinfo__derived">{rateCell.text}</span>
              ) : (
                rateCell.text
              )}
            </dd>
          </div>
          <div>
            <dt>{currencyLabel('Cost', task.currency)}</dt>
            <dd title={costCell.title ?? undefined}>
              {costCell.derived ? (
                <span className="taskinfo__derived">{costCell.text}</span>
              ) : (
                costCell.text
              )}
            </dd>
          </div>
        </dl>
        <div className="taskinfo__notes">
          {/* Contention is said once. Where the criticality note below already names
              the person it is contended with, this would be the second sentence
              about the same fact. */}
          {task.contended
            ? !namesContention && (
                <p className="taskinfo__note">
                  The resource is split with other tasks in progress, so the duration exceeds the
                  effort.
                </p>
              )
            : hasShare(task)
              ? task.elapsedDays > task.effortDays && (
                  <p className="taskinfo__note">
                    Held to its fixed share, so the duration exceeds the effort.
                  </p>
                )
              : task.shared && (
                  <p className="taskinfo__note">
                    The resource does not work full time in this period, so the duration exceeds the
                    effort.
                  </p>
                )}
          {task.fixedEnd ? (
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
      </details>
    </Dialog>
  );
}
