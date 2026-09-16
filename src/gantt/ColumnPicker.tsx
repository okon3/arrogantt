import { useEffect, useRef } from 'react';
import { PLAN_COLUMNS, type PlanColumnName } from './columns';
import type { Project } from './project';

/** Where the button that opened the popover sits, so it can anchor under it. */
export interface ColumnPickerAnchor {
  left: number;
  bottom: number;
}

/**
 * One checkbox per registry entry — the whole of the mechanism, since the
 * registry is the metadata and `onChange` is the only thing a tick does.
 *
 * A non-modal `<dialog>`, modelled on `RowMenu`: it must not dim the plan
 * behind it, and closing on an outside click must not also open an inline
 * editor on the cell the click landed on — the same capture-phase `click` on
 * `document` `RowMenu` uses, ahead of whatever dhtmlx delegates from.
 */
export function ColumnPicker({
  shown,
  project,
  anchor,
  onChange,
  onClose,
}: {
  shown: ReadonlySet<PlanColumnName>;
  project: Project;
  anchor: ColumnPickerAnchor;
  onChange(next: ReadonlySet<PlanColumnName>): void;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    // Measured after layout, not guessed from the item count: the popover
    // opens under the button and would otherwise hang off the edge of a
    // window whose toolbar sits near it.
    const { width, height } = node.getBoundingClientRect();
    const left = Math.min(anchor.left, window.innerWidth - width - 8);
    const top =
      anchor.bottom + height > window.innerHeight
        ? Math.max(8, anchor.bottom - height - 4)
        : anchor.bottom + 4;
    node.style.left = `${Math.max(8, left)}px`;
    node.style.top = `${top}px`;
  }, [anchor]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    // Dismissing is the whole of that gesture, same reasoning as `RowMenu`: a
    // click outside must close the popover and open nothing under it, so it
    // is claimed in capture, on the document, ahead of dhtmlx's own delegate.
    const onClickOutside = (event: MouseEvent) => {
      if (dialog.current?.contains(event.target as Node)) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onClickOutside, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', onClickOutside, true);
    };
  }, [onClose]);

  const toggle = (name: PlanColumnName) => {
    const next = new Set(shown);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(next);
  };

  return (
    <dialog ref={dialog} open className="columnpicker" aria-label="Choose columns">
      <ul className="columnpicker__items">
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
    </dialog>
  );
}
