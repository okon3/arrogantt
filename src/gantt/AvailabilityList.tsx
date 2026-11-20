import type { AvailabilityOverride } from '../scheduler';
import { PercentCell, PeriodRowList } from './PeriodRowList';

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
      valueCell={(period, update) => (
        <PercentCell
          value={period.availability}
          onChange={(availability) => update({ availability })}
        />
      )}
      onChange={onChange}
    />
  );
}
