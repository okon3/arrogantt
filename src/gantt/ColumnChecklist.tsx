import { PLAN_COLUMNS, type PlanColumnName } from './columns';
import type { Project } from './project';

/**
 * One checkbox per registry entry, in registry order — the whole of the
 * mechanism, since the registry is the metadata and `onChange` is the only
 * thing a tick does.
 *
 * Its own component rather than a generalised `ColumnPicker`, because the
 * popover's behaviour is not the list's: non-modal, dismissed by a
 * capture-phase outside click, focus handed back to the button that opened
 * it. A modal dialog must inherit none of that, so the shell stays per
 * client and only the list — the one rule with two clients — is shared.
 */
export function ColumnChecklist({
  shown,
  project,
  onChange,
}: {
  shown: ReadonlySet<PlanColumnName>;
  /** Only to label the columns — the currency rides in the cost headers. */
  project: Project;
  onChange(next: ReadonlySet<PlanColumnName>): void;
}) {
  const toggle = (name: PlanColumnName) => {
    const next = new Set(shown);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(next);
  };

  return (
    <ul className="columnlist">
      {PLAN_COLUMNS.map((entry) => (
        <li key={entry.name}>
          <label>
            <input
              type="checkbox"
              checked={shown.has(entry.name)}
              onChange={() => toggle(entry.name)}
            />
            {entry.label(project)}
          </label>
        </li>
      ))}
    </ul>
  );
}
