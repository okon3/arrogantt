import { Plus, FolderOpen, Sparkles } from 'lucide-react';

/**
 * What is on screen when there is no plan yet.
 *
 * Two ways in and one way to learn how it works. What used to be here — five
 * numbered steps, then a paragraph on effort — moved into the help dialog: it
 * was read once, by somebody who had not yet seen a bar, and from then on it
 * stood between that person and the two buttons they actually came for.
 *
 * The heading is the app's own name and one line saying what kind of tool it is.
 * Naming the absence instead — "No tasks", "An empty plan" — tells somebody
 * staring at an empty screen the one thing they already know.
 *
 * The demo is a hint, not a third way in: somebody new has no plan of their
 * own to judge the tool by, and an empty chart shows neither the split bars
 * nor the look. It sits below the two buttons so it never competes with them.
 */
export function EmptyState({
  onAddTask,
  onOpen,
  onOpenDemo,
  onHelp,
}: {
  onAddTask(): void;
  onOpen(): void;
  onOpenDemo(): void;
  onHelp(): void;
}) {
  return (
    <div className="empty">
      <div className="empty__card">
        <h2>ARROGANTT</h2>
        <p className="empty__lead">
          A Gantt tool built on <strong>effort</strong>: dates are computed by the engine.
        </p>

        <div className="empty__actions">
          <button type="button" className="empty__primary" onClick={onAddTask}>
            <Plus size={15} />
            Create the first task
          </button>
          <button type="button" className="empty__secondary" onClick={onOpen}>
            <FolderOpen size={15} />
            Open a .gantt file
          </button>
        </div>

        <p className="empty__note">
          Or drag a <code>.gantt</code> file here from your computer.
        </p>

        <div className="empty__demo">
          <Sparkles size={15} />
          <p>
            New here?{' '}
            <button type="button" className="empty__link" onClick={onOpenDemo}>
              Open the demo plan
            </button>
            : a small team and a few months of work, ready to explore.
          </p>
        </div>

        <button type="button" className="empty__help empty__link" onClick={onHelp}>
          Need help?
        </button>
      </div>
    </div>
  );
}
