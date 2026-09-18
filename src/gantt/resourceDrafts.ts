import type { AvailabilityOverride } from '../scheduler';
import type { Person, RateOverride } from './cost';
import { nextResourceId } from './resources';

/**
 * The People dialog's own shape for a person, and the two pure conversions to
 * and from `Person[]`. Split out from `ResourceDialog.tsx` so the conversions
 * — where an absent optional key must stay absent through a round trip —
 * are testable without mounting anything.
 *
 * The percentage is the form's unit and stays here; `resources.ts` and the
 * model beneath it work in fractions of a working day.
 */
export interface DraftResource {
  id: string;
  name: string;
  /** Percentage, 100 = full time. Kept as text so a half-typed value survives. */
  availability: string;
  /** Whether the source person declared an `availability`; an absent one must
      stay absent unless the field is actually changed. */
  availabilityDeclared: boolean;
  /** Money per working day, as typed. Blank = absent; the rules live in
      `validateResources`, so an unparseable entry must reach it. */
  dailyRate: string;
  periods: AvailabilityOverride[];
  ratePeriods: RateOverride[];
}

export function toDraft(resources: Person[]): DraftResource[] {
  return resources.map((resource) => ({
    id: resource.id,
    name: resource.name,
    availability: String(Math.round((resource.availability ?? 1) * 100)),
    availabilityDeclared: resource.availability !== undefined,
    dailyRate: resource.dailyRate === undefined ? '' : String(resource.dailyRate),
    periods: resource.availabilityOverrides ?? [],
    ratePeriods: resource.rateOverrides ?? [],
  }));
}

/**
 * The drafts as the model would hold them.
 *
 * The percentage is the form's own unit; everything downstream — the rules, the
 * engine, the file — works in fractions of a working day.
 *
 * The default rate and its periods are written only when they carry
 * something (an empty rate is absent text, an empty period list is omitted
 * entirely), so an intact dialog leaves an absent rate absent and a person
 * with no rate periods keeps no `rateOverrides` key. `availability` follows
 * the same rule: a person who never declared one must not gain
 * `"availability":1` just because the dialog was opened and saved — the file
 * would go dirty and gain a field nobody typed. It is written when the
 * source declared it, or when the typed percentage no longer reads as full
 * time (100%), whichever a real edit produces.
 */
export function toResources(drafts: DraftResource[]): Person[] {
  return drafts.map((draft) => {
    const availability = Number(draft.availability) / 100;
    const writesAvailability = draft.availabilityDeclared || availability !== 1;
    return {
      id: draft.id,
      name: draft.name.trim(),
      ...(writesAvailability ? { availability } : {}),
      ...(draft.periods.length > 0 ? { availabilityOverrides: draft.periods } : {}),
      ...(draft.dailyRate.trim() !== '' ? { dailyRate: Number(draft.dailyRate) } : {}),
      ...(draft.ratePeriods.length > 0 ? { rateOverrides: draft.ratePeriods } : {}),
    };
  });
}

/** The blank row `Add person` inserts, with an id past every existing one. */
export function blankDraft(current: DraftResource[]): DraftResource {
  return {
    id: nextResourceId(toResources(current)),
    name: '',
    availability: '100',
    // A person added here is written with `availability: 1`, exactly like one
    // added through `withResourceAdded` in `resources.ts` — the two paths must
    // not disagree.
    availabilityDeclared: true,
    dailyRate: '',
    periods: [],
    ratePeriods: [],
  };
}
