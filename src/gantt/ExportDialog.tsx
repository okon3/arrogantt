import { useState } from 'react';
import { ColumnChecklist } from './ColumnChecklist';
import { Dialog } from './Dialog';
import type { PlanColumnName } from './columns';
import { setAutofocus } from './autofocus';
import type { ExportSettings } from './exportSettings';
import type { Project } from './project';

/**
 * What a PNG or a print draws, asked before it runs.
 *
 * The draft is initialised from `settings` at mount, like every dialog here —
 * the caller hands over the already-resolved settings, so no fallback rule is
 * written twice (`resolveExportSettings` is its one home).
 */
export function ExportDialog({
  action,
  settings,
  project,
  onCancel,
  onConfirm,
}: {
  /** Decides the title and the confirm button's label; nothing else. */
  action: 'png' | 'print';
  settings: ExportSettings;
  /** Only to label the columns — the currency rides in the cost headers. */
  project: Project;
  onCancel(): void;
  onConfirm(settings: ExportSettings): void;
}) {
  const [scope, setScope] = useState<ExportSettings['scope']>(settings.scope);
  const [columns, setColumns] = useState<ReadonlySet<PlanColumnName>>(settings.columns);
  const [excludeDisabled, setExcludeDisabled] = useState(settings.excludeDisabled);

  return (
    <Dialog
      title={action === 'png' ? 'Export PNG' : 'Print the plan'}
      width={360}
      className="export"
      onDismiss={onCancel}
      footer={
        <>
          <span className="dialog__spacer" />
          <button type="button" className="dialog__btn" onClick={onCancel}>
            Cancel
          </button>
          {/* Focus, against § Dialogs' rule that it rests on the safe option:
              an export undoes itself by closing a file, so Enter may run it. */}
          <button
            type="button"
            className="dialog__btn dialog__btn--primary"
            ref={setAutofocus}
            onClick={() => onConfirm({ scope, columns, excludeDisabled })}
          >
            {action === 'png' ? 'Export' : 'Print'}
          </button>
        </>
      }
    >
      <h3 className="dialog__subhead dialog__subhead--flush">Rows</h3>
      <div className="export__scope">
        <label className="export__option">
          <input
            type="radio"
            name="export-scope"
            checked={scope === 'all'}
            onChange={() => setScope('all')}
          />
          The whole plan
        </label>
        <label className="export__option">
          <input
            type="radio"
            name="export-scope"
            checked={scope === 'visible'}
            onChange={() => setScope('visible')}
          />
          As I see it
        </label>
      </div>
      <p className="dialog__hint">
        “As I see it” draws a collapsed branch as its summary row and leaves its children out.
        The dates always span the whole plan.
      </p>
      <label className="export__option">
        <input
          type="checkbox"
          checked={excludeDisabled}
          onChange={(event) => setExcludeDisabled(event.target.checked)}
        />
        Leave out disabled tasks
      </label>
      <div className="export__head">
        <h3 className="dialog__subhead">Columns</h3>
        <button
          type="button"
          className="dialog__btn export__preset"
          title="Names and bars only: no columns, no disabled tasks"
          onClick={() => {
            setColumns(new Set());
            setExcludeDisabled(true);
          }}
        >
          For the client
        </button>
      </div>
      <ColumnChecklist shown={columns} project={project} onChange={setColumns} />
    </Dialog>
  );
}
