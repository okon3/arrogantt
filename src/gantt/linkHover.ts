import { gantt } from 'dhtmlx-gantt';
import { X } from 'lucide-static';

/** Long enough to carry the pointer from a 2px line to the button beside it. */
const HIDE_DELAY_MS = 350;

/**
 * Brings a link forward while the pointer is on it or on a task at either end,
 * and offers a button to remove the one pointed at.
 *
 * A stylesheet rule, not a class on the nodes: dhtmlx rebuilds the links on
 * every redraw and would drop it.
 */
export function installLinkHover(container: HTMLElement): () => void {
  const rule = document.createElement('style');
  document.head.appendChild(rule);

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
    rule.textContent = linkIds.length
      ? linkIds
          .map((id) => `.gantt-host .gantt_task_link[link_id="${CSS.escape(id)}"]`)
          .join(',') + '{opacity:1;--link-ink:var(--accent)}'
      : '';
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
      // `$task_data` moves with the scroll: no offset to add (docs/dhtmlx.md).
      const origin = gantt.$task_data.getBoundingClientRect();
      remove.style.left = `${event.clientX - origin.left + 6}px`;
      remove.style.top = `${event.clientY - origin.top - 20}px`;
      remove.hidden = false;
      return;
    }
    if (pointed) return;
    const taskId = target.closest<HTMLElement>('[data-task-id]')?.dataset.taskId;
    raise(
      taskId && gantt.isTaskExists(taskId)
        ? gantt
            .getLinks()
            .filter((each) => String(each.source) === taskId || String(each.target) === taskId)
            .map((each) => String(each.id))
        : [],
    );
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
  };
}
