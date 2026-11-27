import { describe, expect, it } from 'vitest';
import type { ProjectTask } from './project';
import { refuseTaskEdit } from './taskEdits';

const task: ProjectTask = {
  id: 't1',
  name: 'Build',
  nominalDays: 3,
  start: new Date(2026, 8, 7, 8, 0),
};

describe('refuseTaskEdit', () => {
  it('lets an edit through that changes nothing it judges', () => {
    expect(refuseTaskEdit(task, { name: 'Build', nominalDays: 3, progress: 0 })).toBeNull();
  });

  it('refuses a progress Save could not write back', () => {
    expect(refuseTaskEdit(task, { progress: Infinity })).toMatch(/Progress/);
    expect(refuseTaskEdit(task, { progress: '0.5' })).toMatch(/Progress/);
    expect(refuseTaskEdit(task, { progress: 1.5 })).toMatch(/Progress/);
    expect(refuseTaskEdit(task, { progress: 0.5 })).toBeNull();
  });

  it('refuses an empty name and an effort that is not a number of days', () => {
    expect(refuseTaskEdit(task, { name: '  ' })).toMatch(/Name/);
    expect(refuseTaskEdit(task, { nominalDays: Number.NaN })).toMatch(/Effort/);
    expect(refuseTaskEdit(task, { nominalDays: -1 })).toMatch(/Effort/);
    expect(refuseTaskEdit(task, { nominalDays: 0 })).toBeNull();
  });

  it('judges only what changes, so a file state the panel never writes still takes other edits', () => {
    const loaded = { ...task, name: '', progress: 2 };
    expect(refuseTaskEdit(loaded, { name: '', progress: 2, nominalDays: 4 })).toBeNull();
  });

  it('refuses a colour and a description the file would refuse', () => {
    expect(refuseTaskEdit(task, { color: 'red' })).toMatch(/Colour/);
    expect(refuseTaskEdit(task, { color: '' })).toBeNull();
    expect(refuseTaskEdit(task, { description: 'x'.repeat(2001) })).toMatch(/limit/);
  });

  it('refuses an end before the start, whichever of the two moved', () => {
    const fixed = { ...task, fixedEnd: new Date(2026, 8, 9, 17, 0) };
    expect(refuseTaskEdit(fixed, { fixedEnd: new Date(2026, 8, 4, 17, 0) })).toMatch(/end/);
    expect(refuseTaskEdit(fixed, { start: new Date(2026, 8, 10, 8, 0) })).toMatch(/end/);
    expect(refuseTaskEdit(fixed, { start: new Date(2026, 8, 8, 8, 0) })).toBeNull();
  });
});
