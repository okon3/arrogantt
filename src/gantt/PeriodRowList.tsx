import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { countWorkingDaysInRange, type DayRange } from '../scheduler';

/**
 * The row template shared by every period-row list that edits a value beside
 * its dates (availability, rate — `DayRangeList` has no such value and stays
 * on its own, plainer grammar). One `.ranges` container, one `.ranges__row
 * ranges__row--pct` grid; `valueCell` supplies whatever sits in the `--pct`
 * modifier's inserted track, so two lists sharing the modifier keep their
 * tracks aligned for free.
 */
export function PeriodRowList<T extends DayRange>({
  periods,
  workingWeekdays,
  emptyMessage,
  newPeriod,
  labelPlaceholder,
  countSuffix,
  valueCell,
  onChange,
}: {
  periods: T[];
  workingWeekdays: number[];
  /** Shown in place of the rows when the list is empty. */
  emptyMessage: string;
  /** The row *Add period* appends, given today as `YYYY-MM-DD`. */
  newPeriod(today: string): T;
  labelPlaceholder(period: T): string;
  /** Appended to the working-day count — `' away'` on a zero-percent row. */
  countSuffix?(period: T): string;
  /** The contents of the `--pct` modifier's value track. */
  valueCell(period: T, update: (patch: Partial<T>) => void): ReactNode;
  onChange(periods: T[]): void;
}): ReactNode {
  const update = (index: number, patch: Partial<T>) => {
    onChange(
      periods.map((period, position) =>
        // A generic spread of `T` does not narrow back to `T` on its own —
        // every field patched here is one `T` already carries, so the result
        // is structurally a `T`; TS just cannot see that through the generic.
        position === index ? ({ ...period, ...patch } as T) : period,
      ),
    );
  };

  const add = () => {
    const today = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    onChange([...periods, newPeriod(iso)]);
  };

  return (
    <div className="ranges">
      {periods.length === 0 && <p className="ranges__empty">{emptyMessage}</p>}

      {periods.map((period, index) => {
        const working = countWorkingDaysInRange(period, workingWeekdays);
        const suffix = countSuffix ? countSuffix(period) : '';
        return (
          <div className="ranges__row ranges__row--pct" key={index}>
            <input
              className="dialog__control ranges__date"
              type="date"
              value={period.from}
              onChange={(event) => update(index, { from: event.target.value } as Partial<T>)}
            />
            <span className="ranges__to">→</span>
            <input
              className="dialog__control ranges__date"
              type="date"
              value={period.to}
              min={period.from}
              onChange={(event) => update(index, { to: event.target.value } as Partial<T>)}
            />
            {valueCell(period, (patch) => update(index, patch))}
            <input
              className="dialog__control ranges__label"
              placeholder={labelPlaceholder(period)}
              value={period.label ?? ''}
              onChange={(event) => update(index, { label: event.target.value } as Partial<T>)}
            />
            <span className={`ranges__count${working === 0 ? ' ranges__count--none' : ''}`}>
              {working === 0
                ? 'no working days'
                : `${working} ${working === 1 ? 'day' : 'days'}${suffix}`}
            </span>
            <button
              type="button"
              className="dialog__btn dialog__btn--danger ranges__remove"
              onClick={() => onChange(periods.filter((_, position) => position !== index))}
              title="Remove"
              aria-label="Remove"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}

      <button type="button" className="dialog__btn ranges__add" onClick={add}>
        Add period
      </button>
    </div>
  );
}
