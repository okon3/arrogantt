import { gantt } from 'dhtmlx-gantt';
import { X } from 'lucide-static';

/** Long enough to carry the pointer along the line to the button on it. */
const HIDE_DELAY_MS = 350;

const linksOf = (taskId: string) =>
  gantt
    .getLinks()
    .filter((each) => String(each.source) === taskId || String(each.target) === taskId)
    .map((each) => String(each.id));

const linkSelector = (ids: string[]) =>
  ids.map((id) => `.gantt-host .gantt_task_link[link_id="${CSS.escape(id)}"]`).join(',');

/**
 * Brings a link forward while the pointer is on it or on a task at either end,
 * and offers a button to remove the one pointed at. While a task is selected,
 * its links stay forward and every other one dims.
 *
 * Stylesheet rules, not classes on the nodes: dhtmlx rebuilds the links on
 * every redraw and would drop them.
 */
export function installLinkHover(container: HTMLElement): () => void {
  const selection = document.createElement('style');
  document.head.appendChild(selection);
  const rule = document.createElement('style');
  document.head.appendChild(rule);

  const followSelection = () => {
    const selected = gantt.getSelectedId();
    const live = selected && gantt.isTaskExists(selected);
    const ids = live ? linksOf(String(selected)) : [];
    selection.textContent = live
      ? `.gantt-host .gantt_task_link{opacity:var(--gantt-dimmed)}` +
        (ids.length ? `${linkSelector(ids)}{opacity:1;--link-ink:var(--accent)}` : '')
      : '';
    return true;
  };
  const selectionEvents = [
    'onTaskSelected',
    'onTaskUnselected',
    'onAfterLinkAdd',
    'onAfterLinkDelete',
    'onAfterTaskDelete',
    'onParse',
  ].map((name) => gantt.attachEvent(name as 'onTaskSelected', followSelection, undefined));

  // In `$task_data`, which survives the redraws that replace the link's node.
  const remove = document.createElement('div');
  remove.className = 'link-x';
  remove.title = 'Remove this dependency';
  remove.innerHTML = X;
  remove.hidden = true;
  gantt.$task_data.appendChild(remove);

  let pointed: string | null = null;
  let hiding: number | undefined;

  const raise = (linkIds: string[]) => {
    rule.textContent = linkIds.length ? `${linkSelector(linkIds)}{opacity:1;--link-ink:var(--accent)}` : '';
  };

  const settle = () => {
    pointed = null;
    remove.hidden = true;
    raise([]);
  };

  const onOver = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (remove.contains(target)) {
      window.clearTimeout(hiding);
      return;
    }
    const link = target.closest<HTMLElement>('.gantt_task_link');
    if (link) {
      window.clearTimeout(hiding);
      pointed = link.getAttribute('link_id');
      if (!pointed) return;
      raise([pointed]);
      // On the middle of the longest stretch, which is where the eye takes the
      // arrow to be; the bounding box's centre can fall off an elbowed line.
      const longest = [...link.querySelectorAll('.gantt_line_wrapper')]
        .map((segment) => segment.getBoundingClientRect())
        .sort((a, b) => b.width + b.height - (a.width + a.height))[0];
      if (!longest) return;
      // Screen to the data's own coordinates: `$task_data` follows a horizontal
      // scroll but scrolls its rows itself, by `scrollTop` (docs/dhtmlx.md).
      const data = gantt.$task_data;
      const origin = data.getBoundingClientRect();
      remove.style.left = `${longest.left + longest.width / 2 - origin.left + data.scrollLeft}px`;
      remove.style.top = `${longest.top + longest.height / 2 - origin.top + data.scrollTop}px`;
      remove.hidden = false;
      return;
    }
    if (pointed) return;
    const taskId = target.closest<HTMLElement>('[data-task-id]')?.dataset.taskId;
    raise(taskId && gantt.isTaskExists(taskId) ? linksOf(taskId) : []);
  };

  const onOut = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!pointed || !(remove.contains(target) || target.closest('.gantt_task_link'))) return;
    window.clearTimeout(hiding);
    hiding = window.setTimeout(settle, HIDE_DELAY_MS);
  };

  const onRemove = (event: MouseEvent) => {
    event.stopPropagation();
    const id = pointed;
    window.clearTimeout(hiding);
    settle();
    if (id && gantt.isLinkExists(id)) gantt.deleteLink(id);
  };

  container.addEventListener('mouseover', onOver);
  container.addEventListener('mouseout', onOut);
  container.addEventListener('mouseleave', settle);
  remove.addEventListener('click', onRemove);

  return () => {
    window.clearTimeout(hiding);
    container.removeEventListener('mouseover', onOver);
    container.removeEventListener('mouseout', onOut);
    container.removeEventListener('mouseleave', settle);
    remove.remove();
    rule.remove();
    selection.remove();
    selectionEvents.forEach((id) => gantt.detachEvent(id));
  };
}
