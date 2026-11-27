import { gantt } from 'dhtmlx-gantt';
import { Ban, Pin, PinOff, Trash2 } from 'lucide-static';
import { bareInfoIcon, sizedIcon } from './gridColumns';

/** Long enough to carry the pointer from the bar to the buttons beside it. */
const HIDE_DELAY_MS = 300;
/** Width of `.gantt_link_control`, the zone holding the link dot past the bar's end. */
const LINK_HANDLE_PX = 18;

export interface BarActionTarget {
  isSummary: boolean;
  isMilestone: boolean;
  fixed: boolean;
  disabled: boolean;
}

export interface BarActions {
  describe(taskId: string): BarActionTarget | undefined;
  info(taskId: string): void;
  toggleAutoEnd(taskId: string): void;
  toggleDisabled(taskId: string, disabled: boolean): void;
  remove(taskId: string): void;
}

const button = (action: string) => {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'bar-actions__btn';
  node.dataset.action = action;
  return node;
};

/**
 * A row of buttons beside the bar the pointer is on: the same actions the grid
 * and the panel offer, one move away from the bar. Lives in `$task_data`, which
 * survives the redraws that replace the bar's node, and scrolls with it.
 */
export function installBarActions(container: HTMLElement, actions: BarActions): () => void {
  const bar = document.createElement('div');
  bar.className = 'bar-actions';
  bar.hidden = true;
  const info = button('info');
  info.innerHTML = bareInfoIcon(14);
  const autoEnd = button('auto-end');
  const disable = button('disable');
  disable.innerHTML = sizedIcon(Ban, 14);
  const remove = button('remove');
  remove.innerHTML = sizedIcon(Trash2, 14);
  remove.classList.add('bar-actions__btn--danger');
  bar.append(info, autoEnd, disable, remove);
  gantt.$task_data.appendChild(bar);

  let shown: string | null = null;
  let hiding: number | undefined;
  // Held from a press on the chart to its release: a drag replaces the bar's
  // node on every move, and each new node under the pointer would show the
  // buttons again, riding along with the bar.
  let pressed = false;

  const hide = () => {
    window.clearTimeout(hiding);
    shown = null;
    bar.hidden = true;
  };

  const show = (taskId: string) => {
    const target = actions.describe(taskId);
    if (!target) return;
    window.clearTimeout(hiding);
    shown = taskId;
    info.title = 'Details';
    autoEnd.hidden = target.isSummary || target.isMilestone;
    autoEnd.innerHTML = sizedIcon(target.fixed ? PinOff : Pin, 14);
    autoEnd.title = target.fixed ? 'Turn Auto end back on' : 'Fix the end (Auto end off)';
    disable.title = target.disabled ? 'Enable' : 'Disable';
    disable.classList.toggle('bar-actions__btn--on', target.disabled);
    remove.title = 'Delete';
    // In the data's own coordinates, as the bars are: `$task_data` scrolls its
    // rows by `scrollTop` (docs/dhtmlx.md), and a screen offset would ignore it.
    const at = gantt.getTaskPosition(gantt.getTask(taskId));
    bar.hidden = false;
    // Short of the timeline's right edge: a long bar's end can be far off screen.
    const onScreenRight =
      gantt.$task.getBoundingClientRect().right - gantt.$task_data.getBoundingClientRect().left;
    // Past the link handle dhtmlx hangs just outside the bar's end, so the dot
    // that starts a dependency stays reachable.
    bar.style.left = `${Math.min(at.left + at.width + LINK_HANDLE_PX + 2, onScreenRight - bar.offsetWidth - 8)}px`;
    bar.style.top = `${at.top + at.rowHeight / 2}px`;
  };

  const onOver = (event: MouseEvent) => {
    if (pressed) return;
    const target = event.target as HTMLElement;
    if (bar.contains(target)) {
      window.clearTimeout(hiding);
      return;
    }
    const node = target.closest<HTMLElement>('.gantt_task_line[data-task-id]');
    if (node) show(node.dataset.taskId!);
  };

  const onOut = (event: MouseEvent) => {
    if (!shown) return;
    const next = event.relatedTarget as HTMLElement | null;
    if (next && (bar.contains(next) || next.closest('.gantt_task_line'))) return;
    window.clearTimeout(hiding);
    hiding = window.setTimeout(hide, HIDE_DELAY_MS);
  };

  const onClick = (event: MouseEvent) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    const taskId = shown;
    // Claimed whole: the click must not also select or drag what is under it.
    event.stopPropagation();
    if (!action || !taskId) return;
    const target = actions.describe(taskId);
    hide();
    if (action === 'info') actions.info(taskId);
    else if (action === 'auto-end') actions.toggleAutoEnd(taskId);
    else if (action === 'disable') actions.toggleDisabled(taskId, target?.disabled === true);
    else if (action === 'remove') actions.remove(taskId);
  };
  const swallow = (event: Event) => event.stopPropagation();

  container.addEventListener('mouseover', onOver);
  container.addEventListener('mouseout', onOut);
  container.addEventListener('mouseleave', hide);
  // A drag or a redraw moves the bar from under the buttons.
  const onPress = (event: PointerEvent) => {
    if (bar.contains(event.target as Node)) return;
    pressed = true;
    hide();
  };
  const onRelease = () => {
    pressed = false;
  };
  container.addEventListener('pointerdown', onPress);
  // On the window: the drag may end anywhere.
  window.addEventListener('pointerup', onRelease);
  window.addEventListener('pointercancel', onRelease);
  bar.addEventListener('click', onClick);
  bar.addEventListener('pointerdown', swallow);
  bar.addEventListener('mousedown', swallow);
  const redrawn = gantt.attachEvent('onDataRender', () => {
    hide();
    return true;
  }, undefined);

  return () => {
    window.clearTimeout(hiding);
    container.removeEventListener('mouseover', onOver);
    container.removeEventListener('mouseout', onOut);
    container.removeEventListener('mouseleave', hide);
    container.removeEventListener('pointerdown', onPress);
    window.removeEventListener('pointerup', onRelease);
    window.removeEventListener('pointercancel', onRelease);
    gantt.detachEvent(redrawn);
    bar.remove();
  };
}
