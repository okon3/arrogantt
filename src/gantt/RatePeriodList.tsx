import type { RateOverride } from './cost';
import { PeriodRowList } from './PeriodRowList';

/**
 * Editor for the periods where somebody's daily rate differs from their
 * default. A fresh row is seeded with that default rather than left blank:
 * `0` prices a day at nothing (F3a), so an unedited row would otherwise price
 * its days for free instead of being a no-op. When the person has no default
 * rate the seed is `0` and that trap stands — there is no default to fall
 * back on.
 */
export function RatePeriodList({
  periods,
  workingWeekdays,
  defaultRate,
  onChange,
}: {
  periods: RateOverride[];
  workingWeekdays: number[];
  /** Seeds a fresh row, so an unedited one is a no-op instead of a free day. */
  defaultRate: number;
  onChange(periods: RateOverride[]): void;
}) {
  return (
    <PeriodRowList<RateOverride>
      periods={periods}
      workingWeekdays={workingWeekdays}
      emptyMessage="No periods: the default rate applies for the whole project."
      newPeriod={(today) => ({ from: today, to: today, dailyRate: defaultRate })}
      labelPlaceholder={() => 'Reason'}
      valueCell={(period, update) => (
        <input
          className="dialog__control ranges__rate"
          type="number"
          min={0}
          value={period.dailyRate}
          // No clamp here: the rate rule is validateResources's alone
          // (finite and >= 0) — Save already routes every draft through it.
          onChange={(event) => update({ dailyRate: Number(event.target.value) })}
        />
      )}
      onChange={onChange}
    />
  );
}
