import { useState } from 'react';
import { X } from 'lucide-react';
import { countWorkingDaysInRange } from '../scheduler';
import { AvailabilityList } from './AvailabilityList';
import type { Person } from './cost';
import { validateCurrency } from './cost';
import { Dialog } from './Dialog';
import { blankDraft, toDraft, toResources, type DraftResource } from './resourceDrafts';
import { releasedBy, validateResources } from './resources';
import { RatePeriodList } from './RatePeriodList';

export interface ResourceUsage {
  /** Number of tasks assigned to each resource id. */
  taskCounts: Map<string, number>;
}

/** Mounted only while open, so the drafts initialise from props without an effect. */
export function ResourceDialog({
  resources,
  usage,
  workingWeekdays,
  currency,
  confirm,
  onCancel,
  onSave,
}: {
  resources: Person[];
  usage: ResourceUsage;
  workingWeekdays: number[];
  /** The project's label as it stands; null = none declared. */
  currency: string | null;
  /** Native dialogs are suppressed in embedded browsers; App owns the real one. */
  confirm(message: string, confirmLabel: string): Promise<boolean>;
  onCancel(): void;
  onSave(resources: Person[], releasedTaskIds: string[], currency: string | null): void;
}) {
  const [drafts, setDrafts] = useState<DraftResource[]>(() => toDraft(resources));
  const [currencyDraft, setCurrencyDraft] = useState(currency ?? '');
  const [error, setError] = useState<string | null>(null);
  /** Which person's absences are expanded; only one at a time keeps it readable. */
  const [expanded, setExpanded] = useState<string | null>(null);

  /** Short summary for the collapsed row: days away/reduced, plus rate periods. */
  const periodSummary = (draft: DraftResource) => {
    let away = 0;
    let reduced = 0;
    for (const period of draft.periods) {
      const working = countWorkingDaysInRange(period, workingWeekdays);
      if (period.availability === 0) away += working;
      else reduced += working;
    }
    const parts: string[] = [];
    if (away > 0) parts.push(`${away} d away`);
    if (reduced > 0) parts.push(`${reduced} d reduced`);
    if (draft.ratePeriods.length > 0) {
      parts.push(
        `${draft.ratePeriods.length} rate ${draft.ratePeriods.length === 1 ? 'period' : 'periods'}`,
      );
    }
    // 'none' is the availability answer; once any part exists, 'none' would
    // read as a contradiction beside it, so it only appears alone.
    return parts.length > 0 ? parts.join(', ') : 'none';
  };

  const update = (index: number, patch: Partial<DraftResource>) => {
    setDrafts((current) =>
      current.map((draft, position) => (position === index ? { ...draft, ...patch } : draft)),
    );
  };

  const remove = async (index: number) => {
    const draft = drafts[index];
    const assigned = usage.taskCounts.get(draft.id) ?? 0;
    if (assigned > 0) {
      const confirmed = await confirm(
        `${draft.name || 'This resource'} is assigned to ${assigned} tasks. ` +
          'Removing it leaves those tasks with no resource, and they will no longer share effort. Continue?',
        'Remove',
      );
      if (!confirmed) return;
    }
    setDrafts((current) => current.filter((_, position) => position !== index));
  };

  const add = () => {
    setDrafts((current) => [...current, blankDraft(current)]);
  };

  const save = () => {
    const next = toResources(drafts);
    const problem = validateResources(next);
    if (problem) {
      setError(problem);
      return;
    }
    // Trimmed here, not by validateCurrency: that rule is for machine input
    // (file, script), and a typed field saving "  " as absent already makes
    // trimming the dialog's own job — same as the rate field beside it.
    const label = currencyDraft.trim();
    const nextCurrency = label === '' ? null : label;
    if (nextCurrency !== null) {
      const currencyProblem = validateCurrency(nextCurrency);
      if (currencyProblem) {
        setError(currencyProblem);
        return;
      }
    }
    onSave(next, releasedBy(resources, next), nextCurrency);
  };

  return (
    <Dialog
      title="People"
      width={728}
      className="people"
      onDismiss={onCancel}
      error={error}
      footer={
        <>
          <button type="button" className="dialog__btn" onClick={add}>
            Add person
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
      <p className="dialog__hint">
        Availability is the share of a working day the person gives to the project: 50% means half
        a day. In <strong>periods</strong> you can override it for specific ranges — 0% is an
        absence. Available effort is still split evenly across concurrent tasks. Rates and costs
        are grid columns, hidden until you turn them on with the toolbar's{' '}
        <strong>Choose grid columns</strong> button.
      </p>

      <label className="people__currency">
        <span>Currency</span>
        <input
          className="dialog__control people__currencyInput"
          type="text"
          placeholder="e.g. EUR"
          value={currencyDraft}
          onChange={(event) => setCurrencyDraft(event.target.value)}
        />
      </label>

      <table className="people__table">
        <colgroup>
          <col />
          <col style={{ width: 88 }} />
          <col style={{ width: 88 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 48 }} />
          <col style={{ width: 36 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Name</th>
            <th>Availability</th>
            <th>Daily rate</th>
            <th>Periods</th>
            <th>Tasks</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {drafts.flatMap((draft, index) => [
            <tr key={draft.id}>
              <td>
                <input
                  className="dialog__control"
                  value={draft.name}
                  placeholder="Full name"
                  onChange={(event) => update(index, { name: event.target.value })}
                />
              </td>
              <td>
                <span className="dialog__field people__field">
                  <input
                    className="dialog__control people__pct"
                    type="number"
                    min={1}
                    max={100}
                    value={draft.availability}
                    onChange={(event) => update(index, { availability: event.target.value })}
                  />
                  <span className="dialog__suffix">%</span>
                </span>
              </td>
              <td>
                <input
                  className="dialog__control people__rate"
                  type="text"
                  inputMode="decimal"
                  value={draft.dailyRate}
                  onChange={(event) => update(index, { dailyRate: event.target.value })}
                />
              </td>
              <td>
                <button
                  type="button"
                  className={`people__absences${
                    expanded === draft.id ? ' people__absences--open' : ''
                  }`}
                  onClick={() => setExpanded(expanded === draft.id ? null : draft.id)}
                  title={periodSummary(draft)}
                >
                  {periodSummary(draft)}
                </button>
              </td>
              <td className="people__count">{usage.taskCounts.get(draft.id) ?? 0}</td>
              <td>
                <button
                  type="button"
                  className="dialog__btn dialog__btn--danger people__remove"
                  onClick={() => void remove(index)}
                  title="Remove"
                  aria-label="Remove"
                >
                  <X size={14} />
                </button>
              </td>
            </tr>,
            expanded === draft.id ? (
              <tr key={`${draft.id}-off`} className="people__offRow">
                <td colSpan={6}>
                  <div className="people__offPanel">
                    <h3 className="dialog__subhead dialog__subhead--flush">Availability periods</h3>
                    <AvailabilityList
                      periods={draft.periods}
                      workingWeekdays={workingWeekdays}
                      onChange={(periods) => update(index, { periods })}
                    />
                    <h3 className="dialog__subhead">Rate periods</h3>
                    <RatePeriodList
                      periods={draft.ratePeriods}
                      workingWeekdays={workingWeekdays}
                      defaultRate={
                        draft.dailyRate.trim() !== '' && Number.isFinite(Number(draft.dailyRate))
                          ? Number(draft.dailyRate)
                          : 0
                      }
                      onChange={(ratePeriods) => update(index, { ratePeriods })}
                    />
                  </div>
                </td>
              </tr>
            ) : null,
          ])}
          {drafts.length === 0 && (
            <tr>
              <td colSpan={6} className="people__empty">
                No people yet. Add one to be able to assign tasks.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Dialog>
  );
}
