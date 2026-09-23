/**
 * What the browser actually paints on a Gantt row, per surface.
 *
 * Browser-side only: no imports, no build step, nothing of src/. Evaluate the
 * whole file in the page and it returns a markdown table — one row per surface
 * (grid row, timeline row, bar) for every task id in `window.__probeRowIds`,
 * or for every row the DOM currently holds when that global is unset.
 *
 * A surface with no node prints `absent` instead of being skipped: smart
 * rendering leaves off-screen bars out of the DOM (docs/dhtmlx.md), and that
 * absence is a reading, not a hole in the table.
 */
(function probeRows(ids) {
  const PROPS = [
    'background-color',
    'box-shadow',
    'outline',
    'border-radius',
    'font-family',
    'color',
  ];
  const BAR_CHILDREN = ['.gantt_link_point', '.gantt_task_drag', '.gantt_side_content'];
  const SURFACES = [
    ['grid', '.gantt_grid_data .gantt_row'],
    ['timeline', '.gantt_task_row'],
    ['bar', '.gantt_bars_area .gantt_task_line'],
  ];
  const COLUMNS = [
    'task',
    'surface',
    'classes',
    'background',
    'box-shadow',
    'outline',
    'radius',
    'font',
    'color',
    'children',
  ];

  const cell = (value) => (value ? String(value).replace(/\|/g, '\\|') : '-');

  // Vendor classes are noise on every row alike; the app's own classes and
  // dhtmlx's selection flag are what a look at the screen is asking about.
  const classes = (node) =>
    Array.from(node.classList)
      .filter((name) => !name.startsWith('gantt_') || name === 'gantt_selected')
      .join(' ');

  const visibleChildren = (bar) => {
    const seen = [];
    BAR_CHILDREN.forEach((selector) => {
      bar.querySelectorAll(selector).forEach((child) => {
        const display = getComputedStyle(child).display;
        if (display !== 'none') seen.push(selector.slice(1) + ':' + display);
      });
    });
    return seen.join(', ');
  };

  const rowsInDom = () => {
    const found = [];
    const selector = SURFACES.map(([, base]) => base + '[task_id]').join(', ');
    document.querySelectorAll(selector).forEach((node) => {
      const id = node.getAttribute('task_id');
      if (!found.includes(id)) found.push(id);
    });
    return found;
  };

  const targets = Array.isArray(ids) && ids.length > 0 ? ids.map(String) : rowsInDom();

  const lines = targets.flatMap((id) =>
    SURFACES.map(([surface, base]) => {
      const node = document.querySelector(base + '[task_id="' + id + '"]');
      const style = node && getComputedStyle(node);
      const values = node
        ? [classes(node)]
            .concat(PROPS.map((prop) => style.getPropertyValue(prop)))
            .concat([surface === 'bar' ? visibleChildren(node) : ''])
        : ['absent', '', '', '', '', '', '', ''];
      return '| ' + [id, surface].concat(values).map(cell).join(' | ') + ' |';
    }),
  );

  const scheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const theme = document.documentElement.getAttribute('data-gantt-theme') || '(unset)';

  return [
    'scheme: ' + scheme + ', data-gantt-theme: ' + theme + ', rows: ' + targets.length,
    '',
    '| ' + COLUMNS.join(' | ') + ' |',
    '| ' + COLUMNS.map(() => '---').join(' | ') + ' |',
  ]
    .concat(lines)
    .join('\n');
})(globalThis.__probeRowIds);
