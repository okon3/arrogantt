import { describe, expect, it } from 'vitest';
import { coverageByLaterRanges } from './dayRange';

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const MON_FRI = [1, 2, 3, 4, 5];
const none = { days: 0, all: false };

describe('coverageByLaterRanges', () => {
  it('reports nothing where periods do not overlap', () => {
    expect(
      coverageByLaterRanges(
        [
          { from: '2026-08-01', to: '2026-08-05' },
          { from: '2026-08-06', to: '2026-08-10' },
        ],
        EVERY_DAY,
      ),
    ).toEqual([none, none]);
  });

  it('counts the days a later period covers, and only on the earlier one', () => {
    expect(
      coverageByLaterRanges(
        [
          { from: '2026-08-01', to: '2026-08-10' },
          { from: '2026-08-08', to: '2026-08-20' },
        ],
        EVERY_DAY,
      ),
    ).toEqual([{ days: 3, all: false }, none]);
  });

  it('flags a narrow period swallowed by a broad one declared after it', () => {
    expect(
      coverageByLaterRanges(
        [
          { from: '2026-08-10', to: '2026-08-14' },
          { from: '2026-07-01', to: '2026-09-30' },
        ],
        EVERY_DAY,
      ),
    ).toEqual([{ days: 5, all: true }, none]);
  });

  it('counts each day once across several later periods', () => {
    expect(
      coverageByLaterRanges(
        [
          { from: '2026-08-01', to: '2026-08-10' },
          { from: '2026-08-01', to: '2026-08-03' },
          { from: '2026-08-03', to: '2026-08-04' },
        ],
        EVERY_DAY,
      ),
    ).toEqual([{ days: 4, all: false }, { days: 1, all: false }, none]);
  });

  it('reads a reversed range the way the engine does', () => {
    expect(
      coverageByLaterRanges(
        [
          { from: '2026-08-14', to: '2026-08-10' },
          { from: '2026-08-01', to: '2026-08-31' },
        ],
        EVERY_DAY,
      ),
    ).toEqual([{ days: 5, all: true }, none]);
  });

  it('ignores a period with an invalid date, as availabilityOnDay does', () => {
    expect(
      coverageByLaterRanges(
        [
          { from: '2026-08-10', to: '2026-08-14' },
          { from: '', to: '2026-08-31' },
          { from: '2026-08-12', to: 'soon' },
        ],
        EVERY_DAY,
      ),
    ).toEqual([none, none, none]);
  });

  it('counts working days but judges full cover on calendar days', () => {
    // Sat 8 Aug 2026 – Fri 14 Aug: five working days; the cover misses the Saturday.
    expect(
      coverageByLaterRanges(
        [
          { from: '2026-08-08', to: '2026-08-14' },
          { from: '2026-08-09', to: '2026-08-31' },
        ],
        MON_FRI,
      ),
    ).toEqual([{ days: 5, all: false }, none]);
  });
});
