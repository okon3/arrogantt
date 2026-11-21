import { gantt } from 'dhtmlx-gantt';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** How far a detour clears the bar it goes round. */
const CLEARANCE = 10;
const ARROW = 5;
/** `.gantt-bar--summary` is drawn 10px tall whatever the row's bar height. */
const SUMMARY_HALF_HEIGHT = 5;

/**
 * The row standing on the chart for `id`: itself, or the topmost closed branch
 * it is inside.
 */
function shownFor(id: string): string {
  let shown = id;
  let parent = gantt.getParent(id);
  while (gantt.isTaskExists(parent)) {
    if (!gantt.getTask(parent).$open) shown = String(parent);
    parent = gantt.getParent(parent);
  }
  return shown;
}

/**
 * Draws the dependencies dhtmlx leaves out: those with an end inside a closed
 * branch. Each is redrawn onto the bar of that branch, dashed, so a task whose
 * successor is folded away does not read as free of dependencies.
 *
 * A layer of our own, not links added to the chart: every link dhtmlx holds is
 * read back into the model as a dependency (`syncLinks`).
 */
export function installRolledLinks(): () => void {
  const layer = document.createElementNS(SVG_NS, 'svg');
  layer.setAttribute('class', 'rolled-links');
  gantt.$task_data.appendChild(layer);

  const paint = () => {
    const rolled = new Map<string, string[]>();
    for (const link of gantt.getLinks()) {
      const source = String(link.source);
      const target = String(link.target);
      if (!gantt.isTaskExists(source) || !gantt.isTaskExists(target)) continue;
      const from = shownFor(source);
      const to = shownFor(target);
      // Both ends on the chart is dhtmlx's to draw; both inside one closed
      // branch is nothing to draw.
      if (from === to || (from === source && to === target)) continue;
      const key = `${from}\n${to}`;
      const named = `${gantt.getTask(source).text} → ${gantt.getTask(target).text}`;
      rolled.set(key, [...(rolled.get(key) ?? []), named]);
    }

    layer.replaceChildren();
    for (const [key, names] of rolled) {
      const [from, to] = key.split('\n');
      const a = gantt.getTaskPosition(gantt.getTask(from));
      const b = gantt.getTaskPosition(gantt.getTask(to));
      const down = b.top > a.top;
      const rowA = a.rowHeight ?? a.height;
      const rowB = b.rowHeight ?? b.height;
      // Out of the bar's end through its edge, not its side: the name sits
      // beside it, and a line leaving sideways would run through it.
      const startX = a.left + a.width - 4;
      const halfBar = gantt.getTask(from).is_summary ? SUMMARY_HALF_HEIGHT : a.height / 2;
      const startY = a.top + rowA / 2 + (down ? halfBar : -halfBar);
      const endX = b.left;
      const endY = b.top + rowB / 2;
      const steps =
        endX - CLEARANCE >= startX
          ? `M ${startX} ${startY} V ${endY} H ${endX}`
          : // The target starts before the source ends: round its row's edge.
            `M ${startX} ${startY} V ${down ? b.top : b.top + rowB} H ${endX - CLEARANCE} V ${endY} H ${endX}`;

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', 'rolled-links__line');
      path.setAttribute('d', steps);
      const head = document.createElementNS(SVG_NS, 'path');
      head.setAttribute('class', 'rolled-links__head');
      head.setAttribute(
        'd',
        `M ${endX} ${endY} l ${-ARROW} ${-ARROW + 1} v ${2 * ARROW - 2} Z`,
      );
      const title = document.createElementNS(SVG_NS, 'title');
      title.textContent = `Inside a closed group:\n${names.join('\n')}`;
      path.appendChild(title);
      layer.append(path, head);
    }
  };

  const handlers = [
    gantt.attachEvent('onGanttRender', paint, undefined),
    gantt.attachEvent('onDataRender', paint, undefined),
  ];

  return () => {
    handlers.forEach((id) => gantt.detachEvent(id));
    layer.remove();
  };
}
