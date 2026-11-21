/**
 * A colour, or none: the swatch row the task and the person share.
 *
 * "Auto" is the absence of a choice, so it shows what the bar falls back to
 * rather than a colour of its own.
 */
export function ColorSwatches({
  value,
  auto,
  autoTitle,
  colors,
  onChange,
}: {
  /** `#rrggbb`, or empty for none. */
  value: string;
  /** What is painted while `value` is empty. */
  auto: string;
  autoTitle: string;
  colors: readonly { key: string; label: string }[];
  onChange(value: string): void;
}) {
  return (
    <div className="taskinfo__colors">
      <button
        type="button"
        className={`taskinfo__auto${value === '' ? ' taskinfo__auto--on' : ''}`}
        title={autoTitle}
        onClick={() => onChange('')}
      >
        Auto
      </button>
      <input
        type="color"
        className="taskinfo__picker"
        value={value || auto}
        aria-label="Bar colour"
        onChange={(event) => onChange(event.target.value)}
      />
      {colors.map((option) => (
        <button
          key={option.key}
          type="button"
          className={`taskinfo__swatch${
            option.key.toLowerCase() === value.toLowerCase() ? ' taskinfo__swatch--on' : ''
          }`}
          style={{ background: option.key }}
          title={option.label}
          onClick={() => onChange(option.key)}
        />
      ))}
      {/* The bar is the only place the colour is ever seen, so the preview is
          shaped like one. */}
      <span className="taskinfo__preview" style={{ background: value || auto }} />
    </div>
  );
}
