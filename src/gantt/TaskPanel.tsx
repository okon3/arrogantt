import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, Trash2, X } from 'lucide-react';
import type { Resource, ShareOverride } from '../scheduler';
import { ColorSwatches } from './ColorSwatches';
import { costCellText, currencyLabel, rateCellText } from './costCells';
import { formatDay, formatDays } from './format';
import type { TaskDetails, TaskPatch } from './ganttHandle';
import { PeriodRowList } from './PeriodRowList';
import type { MeasuredSlack } from './project';
import { hasShare, parseTaskShare, type DatedSharePeriod } from './taskShare';

/** The fields a change writes; the caller adds the rest of the task as it stands. */
export type TaskEdit = Partial<TaskPatch>;

/** A task the panel lists, with the day that matters about it there. */
export interface RelatedTask {
  id: string;
  name: string;
  day: Date;
}

const pad = (value: number) => String(value).padStart(2, '0');
const toDayInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

/** A share as a slider, written by `onSettle` once the gesture ends. */
function PaceSlider({
  percent,
  shown,
  label,
  onChange,
  onSettle,
}: {
  percent: number;
  shown: string;
  label: string;
  onChange(percent: number): void;
  onSettle(): void;
}) {
  return (
    <span className="taskpanel__paceslider">
      <input
        className="taskpanel__range"
        type="range"
        min={0}
        max={100}
        step={5}
        aria-label={label}
        style={{ '--value': `${percent}%` } as CSSProperties}
        value={percent}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onSettle}
        onKeyUp={onSettle}
        onBlur={onSettle}
      />
      <span className="taskpanel__rangevalue">{shown}</span>
    </span>
  );
}

function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle(): void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="taskpanel__switch" onClick={onToggle}>
      <span className="taskpanel__knob" />
    </button>
  );
}

/**
 * A day as text, the calendar on a click, and a working day either way on − / +.
 * The native date input stays under the text, invisible: it holds the picker.
 */
function DayField({
  value,
  label,
  onPick,
  onStep,
}: {
  value: Date;
  label: string;
  onPick(day: string): void;
  onStep(step: number): void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <span className="taskpanel__day">
      <button
        type="button"
        className="taskpanel__value"
        aria-label={`${label}: ${formatDay(value)}, choose a day`}
        onClick={() => picker.current?.showPicker?.()}
      >
        {formatDay(value)}
      </button>
      <input
        ref={picker}
        type="date"
        className="taskpanel__picker"
        tabIndex={-1}
        aria-hidden="true"
        value={toDayInput(value)}
        onChange={(event) => onPick(event.target.value)}
      />
      <Stepper label={label} unit="working day" onStep={onStep} />
    </span>
  );
}

function Stepper({ label, unit, onStep }: { label: string; unit: string; onStep(step: number): void }) {
  return (
    <span className="taskpanel__stepper">
      <button type="button" aria-label={`${label} one ${unit} less`} onClick={() => onStep(-1)}>
        <Minus size={13} />
      </button>
      <button type="button" aria-label={`${label} one ${unit} more`} onClick={() => onStep(1)}>
        <Plus size={13} />
      </button>
    </span>
  );
}

/** A colour's place around the wheel; a grey goes after every hue. */
function hueOrder(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const span = max - Math.min(r, g, b);
  // Saturation, not the channel spread: the palette's grey leans blue.
  if (span / max < 0.25) return 361;
  const hue = max === r ? ((g - b) / span) % 6 : max === g ? (b - r) / span + 2 : (r - g) / span + 4;
  return (hue * 60 + 360) % 360;
}

/** The current colour as a field; the whole palette in a popover under it. */
function ColorField({
  value,
  auto,
  colors,
  onChange,
}: {
  value: string;
  auto: string;
  colors: { key: string; label: string }[];
  onChange(value: string): void;
}) {
  const [open, setOpen] = useState(false);
  const field = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!field.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [open]);
  const name =
    value === '' ? 'Auto' : (colors.find((option) => option.key.toLowerCase() === value.toLowerCase())?.label ?? value);
  const byHue = [...colors].sort((a, b) => hueOrder(a.key) - hueOrder(b.key));
  return (
    <span
      className="taskpanel__colorfield"
      ref={field}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          // Closes the palette, not the panel.
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button type="button" className="taskpanel__value taskpanel__value--menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="taskpanel__dot" style={{ background: value || auto }} />
        {name}
        <ChevronDown size={13} className="taskpanel__chevron" />
      </button>
      {open && (
        <div className="taskpanel__palette" role="dialog" aria-label="Bar colour">
          <ColorSwatches
            value={value}
            auto={auto}
            autoTitle="No colour of its own: its person's when it has one alone, else the default"
            colors={byHue}
            onChange={(next) => {
              onChange(next);
              setOpen(false);
            }}
          />
        </div>
      )}
    </span>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="taskpanel__section">
      <h3 className="taskpanel__sectiontitle">
        {title}
        {count !== undefined && <span className="taskpanel__count">{count}</span>}
      </h3>
      {children}
    </section>
  );
}

/**
 * The task's details beside the chart: every change applies at once, through
 * the same `updateTask` as any other edit, so undo takes each one back.
 * Keyed by task: a new task starts with no field half-edited.
 */
export function TaskPanel({
  task,
  position,
  predecessors,
  successors,
  focusPace,
  pacePeriods,
  paceDays,
  newPacePeriod,
  stepDay,
  slack,
  resources,
  workingDays,
  colors,
  onEdit,
  onToggleAutoEnd,
  onOpenTask,
  onHintTask,
  onStepTask,
  onClose,
  onDelete,
}: {
  task: TaskDetails;
  /** Where the task sits in the row order, 1-based. */
  position: { index: number; total: number };
  /** What it waits for, each with its end. */
  predecessors: RelatedTask[];
  /** What waits for it, each with its start. */
  successors: RelatedTask[];
  /** Bumped when a pace period was just added from the chart: focuses its percent. */
  focusPace?: number;
  /** The task's periods on the dates the plan puts them now. */
  pacePeriods: DatedSharePeriod[];
  /** Those rows back as days of the task, against the same plan; throws what is refused. */
  paceDays(periods: DatedSharePeriod[]): ShareOverride[];
  /** The period a new row starts as on `day`: one day, at the share the task already runs at. */
  newPacePeriod(day: string): DatedSharePeriod;
  /** `date` moved by `step` working days, on the plan's calendar. */
  stepDay(date: Date, step: number): Date;
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
  onOpenTask(id: string): void;
  /** Lights a task on the chart while its row here is pointed at; null puts it out. */
  onHintTask(id: string | null): void;
  /** The previous (−1) or next (+1) task in row order. */
  onStepTask(step: number): void;
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

  // The rules are `refuseTaskEdit`'s, applied where every edit lands; the panel
  // only turns text into values and shows the refusal it gets back.
  const name = useLiveField(task.name, (value) => write({ name: value.trim() }));
  // An empty field is no number: NaN, which the rules refuse, not the 0 Number('') reads.
  const effort = useLiveField(String(task.nominalDays), (value) =>
    write({ nominalDays: value.trim() === '' ? Number.NaN : Number(value) }),
  );
  // Whitespace-only reads as empty (deletes the stored text); otherwise the
  // value goes through verbatim — a description with content is not trimmed.
  const description = useLiveField(task.description ?? '', (value) =>
    write({ description: value.trim() === '' ? '' : value }),
  );
  // The file's gate, so the panel cannot store what Save would refuse.
  const writeShare = (share: number | undefined) => {
    try {
      const pace = parseTaskShare(share, task.shareOverrides, fixed);
      write({ share: pace.share ?? null });
    } catch (problem) {
      refuse((problem as Error).message);
    }
  };
  // Auto is no fixed share; touching the slider fixes one, written on release.
  const paceAuto = task.share === undefined;
  const [paceDraft, setPaceDraft] = useState<number | null>(null);
  const pace = paceDraft ?? (paceAuto ? 100 : Math.round(task.share! * 100));
  const settlePace = () => {
    if (paceDraft !== null) writeShare(paceDraft / 100);
    setPaceDraft(null);
  };

  // Dragged in steps of 5 and written on release: one change, not one per step.
  const [progressDraft, setProgressDraft] = useState<number | null>(null);
  const progress = progressDraft ?? Math.round(task.progress * 100);
  const settleProgress = () => {
    if (progressDraft !== null && progressDraft !== Math.round(task.progress * 100)) {
      write({ progress: progressDraft / 100 });
    }
    setProgressDraft(null);
  };

  // Keeps the time of day the engine assigned: only the calendar day is edited
  // here, and a start at midnight would sit outside the working window.
  const writeStart = (start: Date) => write({ start });
  const pickStart = (value: string) => {
    const day = typedDay(value);
    if (day) writeStart(new Date(day.year, day.month - 1, day.day, task.start.getHours(), task.start.getMinutes()));
  };
  const writeEnd = (end: Date) => write({ fixedEnd: end });
  const pickEnd = (value: string) => {
    const day = typedDay(value);
    if (day) writeEnd(new Date(day.year, day.month - 1, day.day));
  };

  // Rows being edited stay local until the focus leaves the section, so a
  // percent typed digit by digit is one change, not three.
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
  // A period's slider writes on release, like the task's own.
  const settlePeriods = () => {
    if (periodsDraft) writePeriods(periodsDraft);
  };
  const leavePace = (event: FocusEvent<HTMLElement>) => {
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

  const fromChildren = <span className="taskpanel__muted">from subtasks</span>;
  const contendedWith = resources.find(
    (resource) => resource.id === slack?.contendedResourceId,
  )?.name;
  /** Contention explains the criticality, so it is that note's to say. */
  const namesContention = Boolean(slack?.isCritical && contendedWith);
  /** Reads on from either opening, so it starts lower case. */
  const whatCostsWhat = slack?.floatDays
    ? `can start up to ${formatDays(slack.floatDays)} d later, but one more day of work moves the project end`
    : 'any delay here moves the project end';

  // Both entries read the solve, like every other figure the panel computes.
  const rateCell = rateCellText({ dailyRates: task.dailyRates, isSummary: task.isSummary, isMilestone });
  const costCell = costCellText({
    effortDays: task.effortDays,
    cost: task.cost,
    uncostedDays: task.uncostedDays,
    resourceName: resources.find((resource) => resource.id === task.resourceId)?.name ?? null,
    isSummary: task.isSummary,
  });

  return (
    <aside className="taskpanel" aria-label="Task details">
      <div className="taskpanel__top">
        <span className="taskpanel__kind">
          {task.isSummary ? 'Summary' : isMilestone ? 'Milestone' : fixed ? 'Fixed dates' : 'Task'}
        </span>
        <span className="taskpanel__position">
          {position.index} of {position.total}
        </span>
        <button type="button" className="taskpanel__icon" aria-label="Previous task" disabled={position.index <= 1} onClick={() => onStepTask(-1)}>
          <ChevronLeft size={15} />
        </button>
        <button type="button" className="taskpanel__icon" aria-label="Next task" disabled={position.index >= position.total} onClick={() => onStepTask(1)}>
          <ChevronRight size={15} />
        </button>
        <button type="button" className="taskpanel__icon" title="Close" aria-label="Close" onClick={onClose}>
          <X size={15} />
        </button>
      </div>

      <div className="taskpanel__body">
        <input className="taskpanel__name" aria-label="Name" spellCheck={false} {...name} />
        {error && (
          <p className="taskpanel__error" role="alert" key={error}>
            {error}
          </p>
        )}

        <dl className="taskpanel__fields">
          <dt>Resource</dt>
          <dd>
            {task.isSummary ? (
              fromChildren
            ) : (
              <span className="taskpanel__select">
                <select
                  className="taskpanel__value taskpanel__value--menu"
                  aria-label="Resource"
                  value={task.resourceId}
                  onChange={(event) => write({ resourceId: event.target.value || undefined })}
                >
                  <option value="">Nobody</option>
                  {resources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="taskpanel__chevron" />
              </span>
            )}
          </dd>

          <dt>Effort</dt>
          <dd>
            {task.isSummary ? (
              fromChildren
            ) : (
              <>
                <input
                  className="taskpanel__input taskpanel__number"
                  type="number"
                  min={0}
                  max={999}
                  step={0.25}
                  aria-label="Effort in days"
                  {...effort}
                />
                <span className="taskpanel__muted">{fixed ? 'days, unused: end fixed' : 'days'}</span>
                <Stepper
                  label="Effort"
                  unit="day"
                  onStep={(step) => write({ nominalDays: Math.max(0, task.nominalDays + step) })}
                />
              </>
            )}
          </dd>

          {!task.isSummary && (
            <>
              <dt>Milestone</dt>
              <dd>
                <Switch
                  on={isMilestone}
                  label="Milestone"
                  // A milestone is effort 0 on a computed end; leaving it hands back one day.
                  onToggle={() => write(isMilestone ? { nominalDays: 1 } : { nominalDays: 0, fixedEnd: null })}
                />
                <span className="taskpanel__muted">{isMilestone ? 'a date, no work' : ''}</span>
              </dd>
            </>
          )}

          <dt>Start</dt>
          <dd>
            {task.isSummary ? (
              <span className="taskpanel__muted">{formatDay(task.start)}</span>
            ) : (
              <DayField
                value={task.start}
                label="Start"
                onPick={pickStart}
                onStep={(step) => writeStart(stepDay(task.start, step))}
              />
            )}
          </dd>

          <dt>End</dt>
          <dd>
            {fixed ? (
              <DayField
                value={task.end}
                label="End"
                onPick={pickEnd}
                onStep={(step) => writeEnd(stepDay(task.end, step))}
              />
            ) : (
              <span className="taskpanel__muted">{formatDay(task.end)}</span>
            )}
            {!task.isSummary && (
              <span className="taskpanel__auto">
                Auto
                <Switch on={!fixed} label="Auto end" onToggle={onToggleAutoEnd} />
              </span>
            )}
          </dd>

          <dt>Duration</dt>
          <dd>
            <span className={task.shared ? 'gantt-stretched' : undefined}>{formatDays(task.elapsedDays)} d</span>
            <span className="taskpanel__muted">{formatDays(task.effortDays)} d of work</span>
          </dd>

          <dt>Progress</dt>
          <dd>
            <input
              className="taskpanel__range"
              type="range"
              min={0}
              max={100}
              step={5}
              aria-label="Progress"
              style={{ '--value': `${progress}%` } as CSSProperties}
              value={progress}
              onChange={(event) => setProgressDraft(Number(event.target.value))}
              onPointerUp={settleProgress}
              onKeyUp={settleProgress}
              onBlur={settleProgress}
            />
            <span className="taskpanel__rangevalue">{progress}%</span>
          </dd>

          <dt>Colour</dt>
          <dd>
            {task.ownsColor ? (
              <ColorField
                value={task.color ?? ''}
                auto={task.autoColor}
                colors={colors}
                onChange={(color) => write({ color: color || undefined })}
              />
            ) : (
              <span className="taskpanel__muted">
                <span className="taskpanel__dot" style={{ background: task.paintedColor }} />
                its top-level task's
              </span>
            )}
          </dd>

          <dt>{currencyLabel('Cost', task.currency)}</dt>
          <dd title={costCell.title ?? rateCell.title ?? undefined}>
            <span className={costCell.derived ? 'taskpanel__muted' : undefined}>{costCell.text}</span>
            {!task.isSummary && !rateCell.derived && rateCell.text && (
              <span className="taskpanel__muted">{rateCell.text}/d</span>
            )}
          </dd>

          <dt>Disabled</dt>
          <dd>
            <Switch on={task.disabled} label="Disabled" onToggle={() => write({ disabled: !task.disabled })} />
            <span className="taskpanel__muted">no capacity, out of roll-up</span>
          </dd>
        </dl>


        {paced && (
          // A disabled task takes no capacity: a share of it would mean nothing.
          <section className="taskpanel__section taskpanel__pace" ref={paceSection} onBlur={leavePace} inert={task.disabled}>
            <h3 className="taskpanel__sectiontitle">
              Pace
              <span className="taskpanel__auto">
                Auto
                <Switch on={paceAuto} label="Automatic pace" onToggle={() => writeShare(paceAuto ? 1 : undefined)} />
              </span>
            </h3>
            {/* The task's own share, standing for every day no period below claims. */}
            <div className={`taskpanel__pacedefault${paceAuto && paceDraft === null ? ' taskpanel__auto-on' : ''}`}>
              <span className="taskpanel__pacelabel">{periods.length > 0 ? 'Other days' : 'Whole task'}</span>
              <PaceSlider
                percent={pace}
                shown={paceAuto && paceDraft === null ? 'Auto' : `${pace}%`}
                label="Pace on the task's other days"
                onChange={setPaceDraft}
                onSettle={settlePace}
              />
            </div>
            <PeriodRowList<DatedSharePeriod>
              periods={periods}
              workingWeekdays={workingDays}
              emptyMessage=""
              newPeriod={newPacePeriod}
              labelPlaceholder={(period) => (period.share === 0 ? 'Pause' : 'Reason')}
              countSuffix={(period) => (period.share === 0 ? ' paused' : '')}
              overlapRefused
              valueCell={(period, update) => (
                <PaceSlider
                  percent={Math.round(period.share * 100)}
                  shown={`${Math.round(period.share * 100)}%`}
                  label="Pace in this period"
                  onChange={(percent) => update({ share: percent / 100 })}
                  onSettle={settlePeriods}
                />
              )}
              onChange={onPeriodsChange}
            />
          </section>
        )}

        <div className="taskpanel__notes">
          {task.contended
            ? !namesContention && <p>The person is split with other tasks in progress, so it takes longer than its effort.</p>
            : hasShare(task)
              ? task.elapsedDays > task.effortDays && <p>Held to its fixed share, so it takes longer than its effort.</p>
              : task.shared && <p>The person does not work full time in this period, so it takes longer than its effort.</p>}
          {fixed ? (
            <p>Fixed dates: nothing moves it, no dependency holds it, and it has no float. Its effort is the work that fits.</p>
          ) : isMilestone ? (
            <p>Effort 0: a date the plan reaches rather than work it consumes. It occupies nobody.</p>
          ) : slack?.isCritical ? (
            <p>
              <strong>Critical{namesContention ? ` — contended on ${contendedWith}` : ''}.</strong>{' '}
              {namesContention
                ? `Its share is split with other tasks in progress: ${whatCostsWhat}.`
                : `${whatCostsWhat[0].toUpperCase()}${whatCostsWhat.slice(1)}.`}
            </p>
          ) : null}
        </div>

        {predecessors.length > 0 && <Section title="Depends on" count={predecessors.length}>
          {predecessors.map((related) => (
            <button
              key={related.id}
              type="button"
              className="taskpanel__rel"
              onClick={() => onOpenTask(related.id)}
              onMouseEnter={() => onHintTask(related.id)}
              onMouseLeave={() => onHintTask(null)}
              onFocus={() => onHintTask(related.id)}
              onBlur={() => onHintTask(null)}
            >
              <span className="taskpanel__relname">{related.name}</span>
              <span className="taskpanel__muted">ends {formatDay(related.day)}</span>
            </button>
          ))}
        </Section>}

        {successors.length > 0 && <Section title="Blocks" count={successors.length}>
          {successors.map((related) => (
            <button
              key={related.id}
              type="button"
              className="taskpanel__rel"
              onClick={() => onOpenTask(related.id)}
              onMouseEnter={() => onHintTask(related.id)}
              onMouseLeave={() => onHintTask(null)}
              onFocus={() => onHintTask(related.id)}
              onBlur={() => onHintTask(null)}
            >
              <span className="taskpanel__relname">{related.name}</span>
              <span className="taskpanel__muted">starts {formatDay(related.day)}</span>
            </button>
          ))}
        </Section>}


        <Section title="Description">
          <textarea
            className="taskpanel__input taskpanel__textarea"
            rows={3}
            placeholder="Add a description"
            aria-label="Description"
            {...description}
          />
        </Section>

        <div className="taskpanel__foot">
          <button type="button" className="taskpanel__delete" onClick={onDelete}>
            <Trash2 size={13} />
            Delete task
          </button>
        </div>
      </div>
    </aside>
  );
}
