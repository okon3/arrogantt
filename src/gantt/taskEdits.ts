import { endsBeforeStart, type ProjectTask } from './project';
import { DESCRIPTION_LIMIT, HEX_COLOR } from './serialization';

/** An effort the model can schedule: a finite number of days, 0 for a milestone. */
export function isValidEffort(days: unknown): days is number {
  return typeof days === 'number' && Number.isFinite(days) && days >= 0;
}

/** The fields of a task edit the rules below judge, as a caller hands them in. */
export interface TaskEditFields {
  name?: unknown;
  nominalDays?: unknown;
  progress?: unknown;
  color?: unknown;
  description?: unknown;
  start?: Date;
  /** Null hands the end back to the engine. */
  fixedEnd?: Date | null;
}

/**
 * Why an edit cannot be written, or null: the one place the rules for a task's
 * own fields live, so the panel, a script and any later caller are refused
 * alike, before the model takes a value Save would then refuse forever.
 *
 * Judges only what the edit changes. A file may hold states the panel never
 * writes (an empty name, a progress past 1), and an edit that only disables
 * such a task must still go through.
 */
export function refuseTaskEdit(task: ProjectTask, edit: TaskEditFields): string | null {
  const changed = <K extends keyof TaskEditFields>(field: K, current: unknown) =>
    edit[field] !== undefined && edit[field] !== current;
  if (changed('name', task.name) && (typeof edit.name !== 'string' || edit.name.trim() === '')) {
    return 'Name cannot be empty';
  }
  if (changed('nominalDays', task.nominalDays) && !isValidEffort(edit.nominalDays)) {
    return 'Effort must be a number of 0 or more days';
  }
  if (changed('progress', task.progress ?? 0)) {
    const { progress } = edit;
    if (typeof progress !== 'number' || !Number.isFinite(progress) || progress < 0 || progress > 1) {
      return 'Progress must be a number from 0 to 1';
    }
  }
  if (changed('color', task.color) && edit.color !== '' && edit.color !== null) {
    if (typeof edit.color !== 'string' || !HEX_COLOR.test(edit.color)) return 'Colour must be #rrggbb';
  }
  if (changed('description', task.description ?? '')) {
    if (typeof edit.description !== 'string') return 'Description must be text';
    if (edit.description.length > DESCRIPTION_LIMIT) {
      return `Description: ${edit.description.length} characters, the limit is ${DESCRIPTION_LIMIT}`;
    }
  }
  const end = edit.fixedEnd === undefined ? task.fixedEnd : edit.fixedEnd;
  const start = edit.start ?? task.start;
  const datesMoved =
    (edit.fixedEnd !== undefined && edit.fixedEnd?.getTime() !== task.fixedEnd?.getTime()) ||
    (edit.start !== undefined && edit.start.getTime() !== task.start.getTime());
  if (end && datesMoved && endsBeforeStart(start, end)) return 'The end cannot come before the start';
  return null;
}
