import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  ChevronDown,
  File,
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
  Settings2,
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

/** An avatar and the gap after it (`.toolbar__person`, `.toolbar__people`). */
const AVATAR_SLOT_PX = 28;
/** `.toolbar`'s gap between groups. */
const GROUP_GAP_PX = 8;

/**
 * How many avatars (the "+n" counting as one) fit on the bar's line beside
 * everything else on it, re-measured whenever the bar or the file name resizes.
 */
function useAvatarSlots(bar: RefObject<HTMLDivElement | null>, people: number): number {
  const [slots, setSlots] = useState(people);
  useLayoutEffect(() => {
    const node = bar.current;
    if (!node) return;
    const measure = () => {
      const others = [...node.children].filter((child) => !child.classList.contains('toolbar__people'));
      const used = others.reduce((total, child) => total + child.getBoundingClientRect().width, 0);
      const free = node.clientWidth - used - GROUP_GAP_PX * others.length;
      setSlots(Math.max(1, Math.floor((free + 4) / AVATAR_SLOT_PX)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    const file = node.querySelector('.toolbar__file');
    if (file) observer.observe(file);
    return () => observer.disconnect();
  }, [bar, people]);
  return slots;
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
  const bar = useRef<HTMLDivElement>(null);
  const slots = useAvatarSlots(bar, people.length);
  const overflowing = people.length > slots;
  const shown = overflowing ? people.slice(0, slots - 1) : people;
  const hidden = overflowing ? people.slice(slots - 1) : [];
  return (
    <div className="toolbar" ref={bar}>
      <div className="toolbar__group">
        <ToolbarMenu
          icon={<File size={15} />}
          label="File"
          items={[
            { icon: <FilePlus2 size={15} />, label: 'New', onSelect: onNew },
            { icon: <FolderOpen size={15} />, label: 'Open…', onSelect: onOpen },
            // What Save writes is the project, what these write is the schedule
            // derived from it: a file that only goes out, kept apart by a rule.
            {
              icon: <FileSpreadsheet size={15} />,
              label: 'Export CSV',
              title: 'Export the solved plan to CSV (dates, effort and durations)',
              onSelect: onExportCsv,
              separated: true,
            },
            {
              icon: <Image size={15} />,
              label: 'Export PNG',
              title: 'Export the plan as a PNG image',
              onSelect: onExportPng,
            },
            {
              icon: <Printer size={15} />,
              label: 'Print…',
              title: 'Print the plan, or save it as PDF from the print dialog (Ctrl+P)',
              onSelect: onPrint,
            },
          ]}
        />
        <button type="button" onClick={onSave}>
          <Save size={15} />
          Save
        </button>
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
        {/* Set up once per plan, rarely touched after. */}
        <ToolbarMenu
          icon={<Settings2 size={15} />}
          label="Settings"
          items={[
            { icon: <Users size={15} />, label: 'People…', onSelect: onEditResources },
            { icon: <CalendarDays size={15} />, label: 'Calendar…', onSelect: onEditCalendar },
          ]}
        />
      </div>
      {people.length > 0 && (
        <div className="toolbar__group toolbar__people" role="group" aria-label="Highlight">
          {shown.map((person) => {
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
          {/* The rest behind a count, so the bar keeps one line whatever the
              team's size; the count carries the ring when the pin is in there. */}
          {hidden.length > 0 && (
            <ToolbarMenu
              label="More people"
              trigger={{
                className: `toolbar__person toolbar__person--more${
                  hidden.some((person) => person.id === pinned) ? ' toolbar__person--on' : ''
                }`,
                content: `+${hidden.length}`,
              }}
              items={hidden.map((person) => ({
                icon: (
                  <span className="toolbar__menuavatar" style={{ background: avatarColorOf(person) }}>
                    {initialsOf(person.name)}
                  </span>
                ),
                label: person.name,
                resourceId: person.id,
                current: pinned === person.id,
                onSelect: () => onHighlight(pinned === person.id ? null : person.id),
              }))}
            />
          )}
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
  /** A rule above it: the start of another kind of entry. */
  separated?: boolean;
  /** Hovering the entry highlights this person, as their avatar does. */
  resourceId?: string;
  /** The entry in force (the pinned person). */
  current?: boolean;
  onSelect(): void;
}

/** A toolbar button that drops a list, in the row menu's chrome. */
function ToolbarMenu({
  icon,
  label,
  items,
  trigger,
}: {
  icon?: ReactNode;
  label: string;
  items: MenuItem[];
  /** In place of icon, label and chevron. */
  trigger?: { className: string; content: ReactNode };
}) {
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
      <button
        type="button"
        className={trigger?.className}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={trigger ? label : undefined}
        title={trigger ? label : undefined}
        onClick={() => setOpen(!open)}
      >
        {trigger ? (
          trigger.content
        ) : (
          <>
            {icon}
            {label}
            <ChevronDown size={13} />
          </>
        )}
      </button>
      {/* A dialog, like the row menu, so Escape and Del stay with it while open. */}
      {open && (
        <dialog open className="rowmenu toolbar__dropdown" aria-label={label}>
          <ul className="rowmenu__items">
            {items.map((item) => (
              <li key={item.label} className={item.separated ? 'toolbar__separated' : undefined}>
                <button
                  type="button"
                  title={item.title}
                  data-resource-id={item.resourceId}
                  aria-current={item.current || undefined}
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
