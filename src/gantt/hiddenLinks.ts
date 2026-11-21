import { gantt } from 'dhtmlx-gantt';

/** Names of the tasks at the far end of dependencies the chart is not drawing. */
export interface HiddenLinks {
  waitsFor: string[];
  leadsTo: string[];
}

/** The row standing on the chart for `id`: itself, or the topmost closed branch it is inside. */
export function shownFor(id: string): string {
  let shown = id;
  let parent = gantt.getParent(id);
  while (gantt.isTaskExists(parent)) {
    if (!gantt.getTask(parent).$open) shown = String(parent);
    parent = gantt.getParent(parent);
  }
  return shown;
}

/**
 * The dependencies of a row that dhtmlx leaves undrawn, because a link shows
 * only while both its ends are rows on the chart.
 *
 * For a task, those to or from something inside a closed branch. For a closed
 * branch, those of everything inside it that reach outside. One that stays
 * inside the same closed branch is nobody's to report.
 */
export function hiddenLinksOf(id: string): HiddenLinks {
  const waitsFor = new Set<string>();
  const leadsTo = new Set<string>();
  if (!gantt.isTaskExists(id) || shownFor(id) !== id) return { waitsFor: [], leadsTo: [] };

  const members = [id];
  if (!gantt.getTask(id).$open) gantt.eachTask((task) => members.push(String(task.id)), id);
  for (const member of members) {
    const task = gantt.getTask(member);
    const collect = (linkIds: (string | number)[], end: 'source' | 'target', into: Set<string>) => {
      for (const linkId of linkIds) {
        const other = String(gantt.getLink(linkId)[end]);
        if (!gantt.isTaskExists(other)) continue;
        const shown = shownFor(other);
        if (shown === id) continue;
        // Both ends on the chart: the arrow is there.
        if (member === id && shown === other) continue;
        into.add(String(gantt.getTask(other).text));
      }
    };
    collect(task.$source ?? [], 'target', leadsTo);
    collect(task.$target ?? [], 'source', waitsFor);
  }
  return { waitsFor: [...waitsFor], leadsTo: [...leadsTo] };
}
