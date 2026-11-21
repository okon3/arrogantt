import { gantt } from 'dhtmlx-gantt';
import { shownFor } from './hiddenLinks';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** How far a detour clears the bar it goes round. */
const CLEARANCE = 10;
const ARROW = 5;
/** `.gantt-bar--summary` is drawn 10px tall whatever the row's bar height. */
const SUMMARY_HALF_HEIGHT = 5;

/**
 * While a row is pointed at, draws its dependencies that dhtmlx leaves out:
 * those with an end inside a closed branch, redrawn onto that branch's bar.
 *
 * Only for the row under the pointer: drawn for every row at once they
 * drowned the plan. A task that comes both before and after parts of one
 * closed branch gets one line with a head on each end, not two arrows that
 * read as a contradiction.
 *
 * A layer of our own, not links added to the chart: every link dhtmlx holds is
 * read back into the model as a dependency (`syncLinks`).
 */
export function installRolledLinks(container: HTMLElement): () => void {
  const layer = document.createElementNS(SVG_NS, 'svg');
  layer.setAttribute('class', 'rolled-links');
  gantt.$task_data.appendChild(layer);
  let pointed: string | null = null;

  const shape = (className: string, d: string) => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', className);
    path.setAttribute('d', d);
    layer.appendChild(path);
  };

  const paint = () => {
    layer.replaceChildren();
    if (!pointed || !gantt.isTaskExists(pointed)) return;
    // Pairs of rows, in the direction of the dependency.
    const pairs = new Set<string>();
    for (const link of gantt.getLinks()) {
      const source = String(link.source);
      const target = String(link.target);
      if (!gantt.isTaskExists(source) || !gantt.isTaskExists(target)) continue;
      const from = shownFor(source);
      const to = shownFor(target);
      // Both ends on the chart is dhtmlx's to draw; both inside one closed
      // branch is nothing to draw.
      if (from === to || (from === source && to === target)) continue;
      if (from === pointed || to === pointed) pairs.add(`${from}\n${to}`);
    }

    for (const key of pairs) {
      const [from, to] = key.split('\n');
      const both = pairs.has(`${to}\n${from}`);
      // The pair going both ways is drawn once, from the row above.
      const a = gantt.getTaskPosition(gantt.getTask(from));
      const b = gantt.getTaskPosition(gantt.getTask(to));
      if (both && a.top > b.top) continue;
      const down = b.top > a.top;
      const rowA = a.rowHeight ?? a.height;
      const rowB = b.rowHeight ?? b.height;
      // Out of the bar's end through its edge, not its side: the name sits
      // beside it, and a line leaving sideways would run through it.
      const halfBar = gantt.getTask(from).is_summary ? SUMMARY_HALF_HEIGHT : a.height / 2;
      const startX = a.left + a.width - 4;
      const startY = a.top + rowA / 2 + (down ? halfBar : -halfBar);
      const endX = b.left;
      const endY = b.top + rowB / 2;
      shape(
        'rolled-links__line',
        endX - CLEARANCE >= startX
          ? `M ${startX} ${startY} V ${endY} H ${endX}`
          : // The target starts before the source ends: round its row's edge.
            `M ${startX} ${startY} V ${down ? b.top : b.top + rowB} H ${endX - CLEARANCE} V ${endY} H ${endX}`,
      );
      shape('rolled-links__head', `M ${endX} ${endY} l ${-ARROW} ${-ARROW + 1} v ${2 * ARROW - 2} Z`);
      if (both) {
        const tip = down ? -ARROW : ARROW;
        shape(
          'rolled-links__head',
          `M ${startX} ${startY} l ${-ARROW + 1} ${-tip} h ${2 * ARROW - 2} Z`,
        );
      }
    }
  };

  const onOver = (event: MouseEvent) => {
    const id = (event.target as HTMLElement).closest<HTMLElement>('[data-task-id]')?.dataset.taskId;
    if ((id ?? null) === pointed) return;
    pointed = id ?? null;
    paint();
  };
  const onLeave = () => {
    pointed = null;
    paint();
  };

  container.addEventListener('mouseover', onOver);
  container.addEventListener('mouseleave', onLeave);
  const handlers = [
    gantt.attachEvent('onGanttRender', paint, undefined),
    gantt.attachEvent('onDataRender', paint, undefined),
  ];

  return () => {
    container.removeEventListener('mouseover', onOver);
    container.removeEventListener('mouseleave', onLeave);
    handlers.forEach((id) => gantt.detachEvent(id));
    layer.remove();
  };
}
