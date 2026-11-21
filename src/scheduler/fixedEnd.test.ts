import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from './calendar';
import { criticalTasks } from './float';
import { schedule } from './simulate';
import type { Resource, Schedule, Task } from './types';

const MINUTES_PER_DAY = 8 * 60;
/** Monday 7 September 2026. */
const MONDAY = new Date(2026, 8, 7, 8, 0);
const days = (count: number) => count * MINUTES_PER_DAY;
/** The close of the working day `offset` days after that Monday. */
const closeOf = (offset: number) => new Date(2026, 8, 7 + offset, 17, 0);
const openOf = (offset: number) => new Date(2026, 8, 7 + offset, 8, 0);

const alice: Resource = { id: 'alice', name: 'Alice' };
const task = (id: string, effortDays: number, extra: Partial<Task> = {}): Task => ({
  id,
  name: id,
  effort: days(effortDays),
  startConstraint: MONDAY,
  resourceId: 'alice',
  ...extra,
});

function run(tasks: Task[], resources: Resource[] = [alice]) {
  return schedule(tasks, resources, { origin: MONDAY, calendar: DEFAULT_CALENDAR });
}

const span = (result: Schedule, id: string) => {
  const scheduled = result.tasks.get(id)!;
  return [scheduled.startWorkingMinutes / MINUTES_PER_DAY, scheduled.endWorkingMinutes / MINUTES_PER_DAY];
};

const workDone = (result: Schedule, id: string) =>
  result.tasks
    .get(id)!
    .segments.reduce(
      (sum, segment) =>
        sum + segment.rate * (segment.endWorkingMinutes - segment.startWorkingMinutes),
      0,
    );

describe('a task with a fixed end', () => {
  it('runs from its start to its end whatever its effort says', () => {
    const result = run([task('a', 10, { fixedEnd: closeOf(2) })]);
    expect(span(result, 'a')).toEqual([0, 3]);
    expect(result.tasks.get('a')!.end).toEqual(closeOf(2));
  });

  it('reports the work that went in as its effort', () => {
    const result = run([task('a', 10, { fixedEnd: closeOf(2) }), task('b', 1)]);
    // Shares day 0 with b, then has Alice to itself.
    expect(result.tasks.get('a')!.effortMinutes).toBeCloseTo(days(2), 6);
    expect(workDone(result, 'a')).toBeCloseTo(result.tasks.get('a')!.effortMinutes, 6);
  });

  it('takes its part of the person while it runs, and frees it when it closes', () => {
    // b alone would close after 5 days. Sharing with a for 2 it has done 1 by
    // then, and the other 4 take it to day 6.
    const result = run([task('a', 99, { fixedEnd: closeOf(1) }), task('b', 5)]);
    expect(span(result, 'b')).toEqual([0, 6]);
  });

  it('waits for no predecessor, and holds its successors to its own end', () => {
    const result = run([
      task('late', 8),
      task('a', 1, { fixedEnd: closeOf(1), predecessors: ['late'], resourceId: undefined }),
      task('next', 1, { predecessors: ['a'], resourceId: undefined }),
    ]);
    expect(span(result, 'a')).toEqual([0, 2]);
    expect(span(result, 'next')).toEqual([2, 3]);
  });

  it('starts when it was said to, with its person away', () => {
    const away: Resource = {
      ...alice,
      availabilityOverrides: [{ from: '2026-09-07', to: '2026-09-08', availability: 0 }],
    };
    const result = run([task('a', 1, { fixedEnd: closeOf(2) })], [away]);
    expect(span(result, 'a')).toEqual([0, 3]);
    expect(result.tasks.get('a')!.effortMinutes).toBeCloseTo(days(1), 6);
  });

  it('at a share of zero takes nothing and still closes', () => {
    const result = run([task('a', 1, { fixedEnd: closeOf(4), share: 0 }), task('b', 3)]);
    expect(span(result, 'a')).toEqual([0, 5]);
    expect(result.tasks.get('a')!.effortMinutes).toBe(0);
    expect(span(result, 'b')).toEqual([0, 3]);
  });

  it('does not close early on no effort: it is not a milestone', () => {
    const result = run([task('a', 0, { fixedEnd: closeOf(1) })]);
    expect(span(result, 'a')).toEqual([0, 2]);
  });

  it('with an end at or before its start has no length', () => {
    const result = run([task('a', 3, { startConstraint: openOf(2), fixedEnd: closeOf(0) })]);
    expect(span(result, 'a')).toEqual([2, 2]);
  });

  it('is left out of the float measurement, and still weighs on the tasks in it', () => {
    const tasks = [task('a', 99, { fixedEnd: closeOf(1) }), task('b', 5)];
    const measured = criticalTasks(tasks, [alice], run(tasks), {
      origin: MONDAY,
      calendar: DEFAULT_CALENDAR,
    });
    expect(measured.has('a')).toBe(false);
    expect(measured.get('b')!.isCritical).toBe(true);
  });
});
