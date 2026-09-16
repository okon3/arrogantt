import { isDayString, type AvailabilityOverride } from '../scheduler';
import type { Person, RateOverride } from './cost';

/**
 * The rules and transformations of the people list, with no form and no chart
 * around them.
 *
 * `ResourceDialog`, the agent API and the file parser all go through here: the
 * validation rules and the released-resource diff decide whether tasks silently
 * lose their assignee, which is not a thing that may exist in two versions.
 *
 * Availability is a fraction of a full working day, as the model and the file
 * format hold it. The percentage is the form's own unit and stays in the form.
 */
export interface ResourcePatch {
  name?: string;
  /** Share of a full working day, `0..1`. */
  availability?: number;
  availabilityOverrides?: AvailabilityOverride[];
  /** `null` clears the default rate; absent leaves it. */
  dailyRate?: number | null;
  rateOverrides?: RateOverride[];
}

/** `r{n+1}`, ignoring any id that does not follow the pattern. */
export function nextResourceId(resources: Person[]): string {
  const highest = resources.reduce((max, resource) => {
    const match = /^r(\d+)$/.exec(resource.id);
    const numeric = match ? Number(match[1]) : 0;
    return numeric > max ? numeric : max;
  }, 0);
  return `r${highest + 1}`;
}

/**
 * An empty override list is omitted rather than stored, to keep the saved file
 * free of fields that say nothing. Same grammar for `dailyRate`: `null` clears
 * it, `undefined` carries the previous value across (absent stays absent,
 * `0` stays `0`), a number sets it.
 */
function applied(resource: Person, patch: ResourcePatch): Person {
  const overrides = patch.availabilityOverrides ?? resource.availabilityOverrides ?? [];
  const rateOverrides = patch.rateOverrides ?? resource.rateOverrides ?? [];
  const dailyRate = patch.dailyRate === null ? undefined : patch.dailyRate ?? resource.dailyRate;
  const next: Person = {
    id: resource.id,
    name: (patch.name ?? resource.name).trim(),
    availability: patch.availability ?? resource.availability ?? 1,
  };
  if (overrides.length > 0) next.availabilityOverrides = overrides;
  if (dailyRate !== undefined) next.dailyRate = dailyRate;
  if (rateOverrides.length > 0) next.rateOverrides = rateOverrides;
  return next;
}

export function withResourceAdded(resources: Person[], patch: ResourcePatch): Person[] {
  const blank: Person = { id: nextResourceId(resources), name: '', availability: 1 };
  return [...resources, applied(blank, patch)];
}

export function withResourceUpdated(
  resources: Person[],
  id: string,
  patch: ResourcePatch,
): Person[] {
  return resources.map((resource) => (resource.id === id ? applied(resource, patch) : resource));
}

export function withResourceRemoved(resources: Person[], id: string): Person[] {
  return resources.filter((resource) => resource.id !== id);
}

/** Replaces the whole ordered list: where two overrides overlap, the last wins. */
export function withAvailability(
  resources: Person[],
  id: string,
  overrides: AvailabilityOverride[],
): Person[] {
  return withResourceUpdated(resources, id, { availabilityOverrides: overrides });
}

/**
 * The first thing wrong with the list, or null.
 *
 * The message is user-facing English: it reaches the dialog's error line and
 * the `Error` an agent gets back.
 */
export function validateResources(resources: Person[]): string | null {
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  for (const resource of resources) {
    const name = resource.name.trim();
    if (!name) return 'Every person needs a name';
    if (seenNames.has(name.toLowerCase())) return `Duplicate name: "${name}"`;
    seenNames.add(name.toLowerCase());
    if (seenIds.has(resource.id)) return `Duplicate id: "${resource.id}"`;
    seenIds.add(resource.id);
    const availability = resource.availability ?? 1;
    // Zero is refused as a default because a person who never works is a person
    // to remove; as an override it is exactly how an absence is expressed.
    if (!Number.isFinite(availability) || availability <= 0 || availability > 1) {
      return `Invalid availability for "${name}": expected a share between 0 (excluded) and 1`;
    }
    for (const period of resource.availabilityOverrides ?? []) {
      if (!period.from || !period.to) return `A period of "${name}" has no start or end`;
      if (!isDayString(period.from) || !isDayString(period.to)) {
        return `A period of "${name}" has a malformed date: expected YYYY-MM-DD`;
      }
      // A JS caller can hand the agent API an override without the field: the
      // comparisons below are all false on undefined, and the NaN it becomes in
      // the capacity math stalls the scheduler long after the write was accepted.
      if (typeof period.availability !== 'number' || Number.isNaN(period.availability)) {
        return `A period of "${name}" needs a numeric "availability" share, 0..1`;
      }
      if (period.availability < 0 || period.availability > 1) {
        return `A period of "${name}" has a share outside 0..1`;
      }
    }
    if (resource.dailyRate !== undefined) {
      if (!Number.isFinite(resource.dailyRate) || resource.dailyRate < 0) {
        return `Invalid daily rate for "${name}": expected a number of 0 or more`;
      }
    }
    // Unlike availability, zero is accepted as a default rate: nothing in the
    // simulation stalls on a person who costs nothing, so a declared free
    // person is just a fact, not a person to remove.
    for (const period of resource.rateOverrides ?? []) {
      if (!period.from || !period.to) return `A rate period of "${name}" has no start or end`;
      if (!isDayString(period.from) || !isDayString(period.to)) {
        return `A rate period of "${name}" has a malformed date: expected YYYY-MM-DD`;
      }
      // Finite, not merely not-NaN: an `Infinity` computed by a caller passes a
      // NaN test, and `JSON.stringify` writes it as `null` — a project whose own
      // input text this parser then refuses, taking Save, undo and the draft
      // with it. The availability twin above can settle for NaN because its
      // `> 1` line catches the infinities.
      if (!Number.isFinite(period.dailyRate)) {
        return `A rate period of "${name}" needs a numeric "dailyRate"`;
      }
      if (period.dailyRate < 0) {
        return `A rate period of "${name}" has a negative rate`;
      }
    }
  }
  return null;
}

/**
 * The resources that `next` no longer has.
 *
 * Their tasks are released to "no resource"; getting this list wrong unassigns
 * somebody's work without saying so, which is why the caller never builds it.
 */
export function releasedBy(previous: Person[], next: Person[]): string[] {
  const surviving = new Set(next.map((resource) => resource.id));
  return previous.map((resource) => resource.id).filter((id) => !surviving.has(id));
}
