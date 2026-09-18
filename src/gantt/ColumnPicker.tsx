import { useEffect, useRef } from 'react';
import { ColumnChecklist } from './ColumnChecklist';
import type { PlanColumnName } from './columns';
import type { Project } from './project';

/** Where the button that opened the popover sits, so it can anchor under it. */
export interface ColumnPickerAnchor {
  left: number;
  bottom: number;
}

/**
 * The grid's own client of `ColumnChecklist`: this file owns the popover, not
 * the list of columns.
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
  // The toolbar button that opened this popover, so Escape can hand focus
  // back to it. Captured here rather than passed as a prop: whoever opens the
  // picker already has focus on the right element, and reading it beats
  // threading a new prop through `App.tsx` for one keystroke's benefit.
  //
  // Read during render, not in a `useEffect([])`: StrictMode mounts effects
  // twice (mount, cleanup, mount again) and the first pass's own focus-moving
  // effect below runs in between, so an effect-based read would capture the
  // popover's own checkbox instead of the button — measured on this file.
  // Nothing shifts focus between two render-phase calls, so this is safe to
  // (and, under StrictMode, does) run twice.
  const opener = useRef<Element | null>(null);
  if (opener.current === null) opener.current = document.activeElement;

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
    // `RowMenu.tsx`'s precedent: an explicit `.focus()` here, not
    // `setAutofocus` — that attribute is only honoured by `showModal()`, and
    // this dialog, like `RowMenu`'s, is deliberately never made modal.
    node.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus();
  }, [anchor]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        // Only Escape returns focus: an outside click already moved it where
        // the user aimed, and pulling it back to the button would be a new
        // defect, not a fix of this one.
        (opener.current as HTMLElement | null)?.focus?.();
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const boxes = [
          ...(dialog.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ?? []),
        ];
        const from = boxes.indexOf(document.activeElement as HTMLInputElement);
        if (from === -1) return;
        event.preventDefault();
        const next = boxes[(from + (event.shiftKey ? -1 : 1) + boxes.length) % boxes.length];
        next.focus();
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

  return (
    <dialog ref={dialog} open className="columnpicker" aria-label="Choose columns">
      <ColumnChecklist shown={shown} project={project} onChange={onChange} />
    </dialog>
  );
}
