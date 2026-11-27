import { Dialog } from './Dialog';
import { CRITICAL_CHAIN_LIMIT } from './project';
import { roundedOutline, type Point } from './segmentBar';

/**
 * The person both tasks in the diagram are assigned to.
 *
 * Invented, and her avatar is drawn rather than derived: `avatarColorOf` answers
 * for somebody in the project, and nobody in the diagram is.
 */
const PERSON = { initials: 'AD', colour: '#5b6ebd' };

/**
 * The fill of a shared bar, kept in step with gantt.css — same default blue, and
 * it reads on either scheme. The bare track around it does not, so that one is
 * `.help__track` and comes from the same variables the chart draws it with.
 */
const FILL = '#3b74d6';
const FILL_LINE = '#2a539a';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S', 'M'];
const COLUMN = 60;
const AXIS_X = 110;
const BAR_HEIGHT = 28;
/** `--radius-bar`: an SVG `rx` cannot read a CSS variable. */
const BAR_RADIUS = 6;

const dayX = (day: number) => AXIS_X + day * COLUMN;
/** The top edge of the fill for a given rate: the profile hangs from the floor. */
const rateY = (top: number, rate: number) => top + BAR_HEIGHT * (1 - rate);

/**
 * A profile through `steps` ([from day, to day, rate]), traced by the helper
 * the chart's bars use, so its steps are rounded the same way.
 */
const profile = (top: number, steps: [number, number, number][]) => {
  const floor = top + BAR_HEIGHT;
  const points: Point[] = [[dayX(steps[0][0]), floor]];
  for (const [from, to, rate] of steps) {
    points.push([dayX(from), rateY(top, rate)], [dayX(to), rateY(top, rate)]);
  }
  points.push([dayX(steps[steps.length - 1][1]), floor]);
  return roundedOutline(points, 100, 100);
};

/**
 * The one thing a Gantt of this kind shows that an ordinary one does not: two
 * tasks on the same person, and the dip in the middle where they share her.
 *
 * Drawn rather than screenshotted. A screenshot would be a binary in the repo
 * that goes stale the first time a colour or a radius changes, and it could not
 * be as legible as this at 620px — the real chart carries a grid, a scale and a
 * toolbar that are noise to the point being made. The geometry below is the same
 * one `segmentBar.ts` computes: the fill hangs from the bottom of the bar and
 * its height is the share of the day that person is giving the task.
 */
function EffortDiagram() {
  const rowA = 44;
  const rowB = 96;
  const label = (x: number, y: number, text: string) => (
    <text x={x} y={y} className="help__pct" textAnchor="middle" dominantBaseline="middle">
      {text}
    </text>
  );

  return (
    <svg
      className="help__diagram"
      viewBox="0 0 620 162"
      role="img"
      aria-label="Two tasks assigned to the same person that overlap: on the days they share, each progresses at 50%."
    >
      <defs>
        <clipPath id="help-bar-a">
          <rect x={dayX(0)} y={rowA} width={COLUMN * 8} height={BAR_HEIGHT} rx={BAR_RADIUS} />
        </clipPath>
        <clipPath id="help-bar-b">
          <rect x={dayX(2)} y={rowB} width={COLUMN * 2} height={BAR_HEIGHT} rx={BAR_RADIUS} />
        </clipPath>
      </defs>

      {/* Saturday and Sunday, in the same translucent grey the timeline uses. */}
      <rect x={dayX(5)} y={22} width={COLUMN * 2} height={108} className="help__weekend" />

      {DAYS.map((day, index) => (
        <g key={index}>
          <line x1={dayX(index)} y1={22} x2={dayX(index)} y2={130} className="help__gridline" />
          <text x={dayX(index) + COLUMN / 2} y={14} className="help__day" textAnchor="middle">
            {day}
          </text>
        </g>
      ))}
      <line x1={dayX(8)} y1={22} x2={dayX(8)} y2={130} className="help__gridline" />

      {[
        { y: rowA, name: 'Analysis', effort: '5d' },
        { y: rowB, name: 'Report', effort: '1d' },
      ].map((row) => (
        <g key={row.name}>
          <circle cx={16} cy={row.y + BAR_HEIGHT / 2} r={10} fill={PERSON.colour} />
          <text
            x={16}
            y={row.y + BAR_HEIGHT / 2}
            className="help__avatar"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {PERSON.initials}
          </text>
          <text x={32} y={row.y + BAR_HEIGHT / 2} className="help__rowname" dominantBaseline="middle">
            {row.name} · {row.effort}
          </text>
        </g>
      ))}

      {/* Analysis: five days of effort, at full rate until Report joins it. */}
      <rect
        x={dayX(0)}
        y={rowA}
        width={COLUMN * 8}
        height={BAR_HEIGHT}
        rx={BAR_RADIUS}
        className="help__track"
      />
      <path
        clipPath="url(#help-bar-a)"
        fill={FILL}
        stroke={FILL_LINE}
        strokeWidth={1.5}
        strokeLinejoin="round"
        // The weekend is not a pause in working time, so the level carries
        // across it as one segment — exactly as the real bar draws it.
        d={profile(rowA, [
          [0, 2, 1],
          [2, 4, 0.5],
          [4, 8, 1],
        ])}
      />
      {label(dayX(1), rateY(rowA, 1) + BAR_HEIGHT / 2, '100%')}
      {label(dayX(3), rateY(rowA, 0.5) + BAR_HEIGHT / 4, '50%')}
      {label(dayX(6), rateY(rowA, 1) + BAR_HEIGHT / 2, '100%')}

      {/* Report: one day of effort, never alone, so it takes two. */}
      <rect
        x={dayX(2)}
        y={rowB}
        width={COLUMN * 2}
        height={BAR_HEIGHT}
        rx={BAR_RADIUS}
        className="help__track"
      />
      <path
        clipPath="url(#help-bar-b)"
        fill={FILL}
        stroke={FILL_LINE}
        strokeWidth={1.5}
        strokeLinejoin="round"
        d={profile(rowB, [[2, 4, 0.5]])}
      />
      {label(dayX(3), rateY(rowB, 0.5) + BAR_HEIGHT / 4, '50%')}

      {/* Effort against elapsed time: the one comparison the picture exists for. */}
      <path
        className="help__span"
        d={`M ${dayX(0)},${136} L ${dayX(0)},${144} M ${dayX(0)},${140} L ${dayX(8)},${140} M ${dayX(8)},${136} L ${dayX(8)},${144}`}
      />
      <text x={dayX(4)} y={155} className="help__spanlabel" textAnchor="middle">
        5 days of effort, 8 calendar days
      </text>
    </svg>
  );
}

/**
 * What the chart is showing, for whoever did not build it.
 *
 * Reachable from the header and from the empty state, because those are the two
 * moments someone looks for it: in front of a plan they cannot read, and in
 * front of nothing at all.
 */
export function HelpDialog({ onClose }: { onClose(): void }) {
  return (
    <Dialog
      title="How it works"
      width={720}
      className="help"
      onDismiss={onClose}
      footer={
        <>
          <span className="dialog__spacer" />
          <button type="button" className="dialog__btn dialog__btn--primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <p className="dialog__hint dialog__hint--wide">
        For each task you enter the work and the earliest start. The app works out the end date
        from how much time the assigned person has.
      </p>

      <section className="help__section">
        <h3>Effort, start and end</h3>
        <p>
          <strong>Effort</strong> is how many days one person would need working only on this task.{' '}
          <strong>Start</strong> is the earliest day it can begin; on a day off, it moves to the next
          working day.
        </p>
        <p>
          A task with dates already decided, like a workshop or finished work: select it and turn off{' '}
          <strong>Auto end</strong> in the panel on the right. <strong>Pace</strong>, in the same
          panel, sets how much of the person's time the task gets, for the whole task or for some
          days. 0% pauses it.
        </p>
      </section>

      <section className="help__section">
        <h3>Two tasks, one person</h3>
        <figure className="help__figure">
          <EffortDiagram />
          <figcaption className="help__caption">
            Ada has <strong>Analysis</strong> (5 days, from Monday) and <strong>Report</strong> (1
            day, from Wednesday). On Wednesday and Thursday each gets half her day. Analysis is back
            to 100% on Friday and, skipping the weekend, ends on Monday.
          </figcaption>
        </figure>
        <p>The height of the fill is the share of the person's day the task gets.</p>
      </section>

      <section className="help__section">
        <h3>Days off and availability</h3>
        <p>
          Nights, weekends, holidays and company closures don't count. Grey bands are days off; red
          bands are a person's absence or a closure for everyone.
        </p>
        <p>
          In People, a person works 100% unless you set less. A period with its own percentage
          replaces that value for those days, it doesn't multiply it: 25% over a base of 50% is
          25%. 0% is an absence.
        </p>
      </section>

      <section className="help__section">
        <h3>Groups and unassigned tasks</h3>
        <p>
          A group is a task with subtasks. Its effort and dates are the totals of its subtasks, and a
          link to it is a link to each of them. A task with nobody assigned always runs at 100%.
        </p>
      </section>

      <section className="help__section">
        <h3>Red outline: what sets the end date</h3>
        <p>
          Delaying a task outlined in <strong>red</strong>, or adding work to it, moves the end of the
          plan. A task can be red just because it shares a person with other red tasks; select it to
          see why.
        </p>
        <p>
          Plans over {CRITICAL_CHAIN_LIMIT} tasks update this only when you click{' '}
          <strong>Critical chain</strong> in the status bar; after an edit the outlines turn{' '}
          <strong>dashed</strong> until you click it again.
        </p>
      </section>
    </Dialog>
  );
}
