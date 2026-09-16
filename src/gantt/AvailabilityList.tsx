import type { AvailabilityOverride } from '../scheduler';
import { PeriodRowList } from './PeriodRowList';

/**
 * Editor for the periods where somebody's availability differs from their
 * default. Zero percent is an absence — same mechanism, no separate concept.
 */
export function AvailabilityList({
  periods,
  workingWeekdays,
  onChange,
}: {
  periods: AvailabilityOverride[];
  workingWeekdays: number[];
  onChange(periods: AvailabilityOverride[]): void;
}) {
  return (
    <PeriodRowList<AvailabilityOverride>
      periods={periods}
      workingWeekdays={workingWeekdays}
      emptyMessage="No periods: the default availability applies for the whole project."
      newPeriod={(today) => ({ from: today, to: today, availability: 0 })}
      labelPlaceholder={(period) => (period.availability === 0 ? 'Leave' : 'Reason')}
      countSuffix={(period) => (period.availability === 0 ? ' away' : '')}
      valueCell={(period, update) => {
        const percent = Math.round(period.availability * 100);
        return (
          <span className="dialog__field">
            <input
              className="dialog__control ranges__pct"
              type="number"
              min={0}
              max={100}
              step={5}
              value={percent}
              onChange={(event) => {
                const next = Number(event.target.value);
                update({
                  availability: Number.isFinite(next) ? Math.min(100, Math.max(0, next)) / 100 : 0,
                });
              }}
            />
            <span className="dialog__suffix">%</span>
          </span>
        );
      }}
      onChange={onChange}
    />
  );
}
