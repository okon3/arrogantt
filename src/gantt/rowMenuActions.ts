import type { RowMenuAction, RowMenuTarget } from './RowMenu';

/** Whether an action means anything on the row the menu opened on. */
export function offersAction(
  action: RowMenuAction,
  target: Pick<RowMenuTarget, 'isSummary' | 'isMilestone'>,
): boolean {
  if (action === 'close-gaps') return target.isSummary;
  // Only work can be paced: not a summary, which is never scheduled, nor an instant.
  if (action === 'pace') return !target.isSummary && !target.isMilestone;
  return true;
}
