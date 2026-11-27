import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ChevronDown,
  File,
  FileDown,
  FilePlus2,
  FolderOpen,
  Save,
  FileSpreadsheet,
  Image,
  Printer,
  Undo2,
  Redo2,
  Users,
  CalendarDays,
} from 'lucide-react';
import type { Resource } from '../scheduler';
import { avatarColorOf, initialsOf } from './colors';

export interface ToolbarProps {
  filename: string;
  dirty: boolean;
  people: Resource[];
  /** Whose highlight is pinned, as opposed to borrowed by a hover. */
  pinned: string | null;
  /** What the next undo would take back, or null when there is nothing to undo. */
  undoing: string | null;
  redoing: string | null;
  onNew(): void;
  onOpen(): void;
  onSave(): void;
  onExportCsv(): void;
  onExportPng(): void;
  onPrint(): void;
  onUndo(): void;
  onRedo(): void;
  onRename(filename: string): void;
  onEditResources(): void;
  onEditCalendar(): void;
  onHighlight(resourceId: string | null): void;
}

export function Toolbar({
  filename,
  dirty,
  people,
  pinned,
  undoing,
  redoing,
  onNew,
  onOpen,
  onSave,
  onExportCsv,
  onExportPng,
  onPrint,
  onUndo,
  onRedo,
  onRename,
  onEditResources,
  onEditCalendar,
  onHighlight,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar__group">
        <ToolbarMenu
          icon={<File size={15} />}
          label="File"
          items={[
            { icon: <FilePlus2 size={15} />, label: 'New', onSelect: onNew },
            { icon: <FolderOpen size={15} />, label: 'Open…', onSelect: onOpen },
          ]}
        />
        <button type="button" onClick={onSave}>
          <Save size={15} />
          Save
        </button>
      </div>
      {/* Its own group rather than beside Save: what Save writes is the
          project, what this writes is the schedule derived from it — a file
          that comes back in is one thing, a file that only goes out is
          another. */}
      <div className="toolbar__group">
        <ToolbarMenu
          icon={<FileDown size={15} />}
          label="Export"
          items={[
            {
              icon: <FileSpreadsheet size={15} />,
              label: 'CSV',
              title: 'Export the solved plan to CSV (dates, effort and durations)',
              onSelect: onExportCsv,
            },
            { icon: <Image size={15} />, label: 'PNG', title: 'Export the plan as a PNG image', onSelect: onExportPng },
            {
              icon: <Printer size={15} />,
              label: 'Print',
              title: 'Print the plan, or save it as PDF from the print dialog (Ctrl+P)',
              onSelect: onPrint,
            },
          ]}
        />
      </div>
      <div className="toolbar__group">
        {/* The title names the step rather than only saying there is one: a
            plan is edited from the grid, the bars, the dialogs and a script
            alike, and a bare "Undo" leaves the user guessing which of them
            is about to be taken back. */}
        <button
          type="button"
          className="toolbar__icon"
          onClick={onUndo}
          disabled={undoing === null}
          aria-label={undoing ? `Undo: ${undoing}` : 'Undo change'}
          title={undoing ? `Undo: ${undoing} (Ctrl+Z)` : 'Nothing to undo'}
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          className="toolbar__icon"
          onClick={onRedo}
          disabled={redoing === null}
          aria-label={redoing ? `Redo: ${redoing}` : 'Redo change'}
          title={redoing ? `Redo: ${redoing} (Ctrl+Shift+Z)` : 'Nothing to redo'}
        >
          <Redo2 size={15} />
        </button>
      </div>
      <div className="toolbar__group">
        <button type="button" onClick={onEditResources}>
          <Users size={15} />
          People
        </button>
        <button type="button" onClick={onEditCalendar}>
          <CalendarDays size={15} />
          Calendar
        </button>
      </div>
      {people.length > 0 && (
        <div className="toolbar__group toolbar__people" role="group" aria-label="Highlight">
          {people.map((person) => {
            // The ring follows the pin, never the hover: what is pinned has to
            // stay readable while the pointer borrows the highlight elsewhere.
            const on = pinned === person.id;
            return (
              <button
                key={person.id}
                type="button"
                className={`toolbar__person${on ? ' toolbar__person--on' : ''}`}
                // Inline, like the avatars in the grid: the same person must
                // carry the same colour in both places.
                style={{ background: avatarColorOf(person) }}
                aria-pressed={on}
                title={on ? `Stop highlighting ${person.name}` : `Highlight ${person.name}`}
                // Hovering highlights this person for as long as the pointer
                // stays, wherever their avatar is: App tracks the attribute
                // rather than a handler of this button's own.
                data-resource-id={person.id}
                onClick={() => onHighlight(on ? null : person.id)}
              >
                {initialsOf(person.name)}
              </button>
            );
          })}
        </div>
      )}
      <FileName filename={filename} dirty={dirty} onRename={onRename} />
    </div>
  );
}

interface MenuItem {
  icon: ReactNode;
  label: string;
  title?: string;
  onSelect(): void;
}

/** A toolbar button that drops a list, in the row menu's chrome. */
function ToolbarMenu({ icon, label, items }: { icon: ReactNode; label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);
  return (
    <div className="toolbar__menu" ref={root}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {icon}
        {label}
        <ChevronDown size={13} />
      </button>
      {/* A dialog, like the row menu, so Escape and Del stay with it while open. */}
      {open && (
        <dialog open className="rowmenu toolbar__dropdown" aria-label={label}>
          <ul className="rowmenu__items">
            {items.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  title={item.title}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </dialog>
      )}
    </div>
  );
}

const PROJECT_SUFFIX = /\.gantt$/i;

/** The project's name is its file's: a double click renames what Save writes. */
function FileName({ filename, dirty, onRename }: { filename: string; dirty: boolean; onRename(name: string): void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const stem = draft?.trim().replace(PROJECT_SUFFIX, '');
    setDraft(null);
    if (stem) onRename(`${stem}.gantt`);
  };
  return (
    <span
      className="toolbar__file"
      title="Double-click to rename"
      onDoubleClick={() => setDraft(filename.replace(PROJECT_SUFFIX, ''))}
    >
      {draft === null ? (
        filename
      ) : (
        <input
          className="toolbar__rename"
          aria-label="Project name"
          autoFocus
          value={draft}
          size={Math.max(draft.length, 8)}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.target.select()}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            else if (event.key === 'Escape') {
              // The edit's own: the panel's Escape must not also close.
              event.stopPropagation();
              setDraft(null);
            }
          }}
        />
      )}
      {dirty && <span className="toolbar__dirty" title="Unsaved changes" />}
    </span>
  );
}
