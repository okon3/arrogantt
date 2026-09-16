/**
 * How the view shows the figures the engine computed.
 *
 * Everything here is display only: nothing it returns goes back into the model,
 * and none of it is a second opinion about the schedule.
 */

/**
 * A figure of days as the UI prints it, wherever it prints one.
 *
 * Effort is entered in quarters of a day, so a fraction carries information and
 * must survive — while a trailing zero does not: a summary rolled up to `9.00g`
 * beside a leaf's `5g` reads as two different kinds of number rather than as the
 * same one. Two decimals is the resolution of the input, and rounding there is
 * also what hides the noise a rollup picks up from floating point when it adds a
 * quarter of a day to a half.
 *
 * Unitless on purpose: the grid writes `5g` where a dialog writes `5 g`, and the
 * suffix is the caller's business.
 */
export function formatDays(days: number): string {
  return String(Number(days.toFixed(2)));
}

const moneyFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });

/**
 * A figure of money as the UI prints it, wherever it prints one.
 *
 * Grouped, so a five-figure total is read at a glance, and at most two decimals:
 * a rate may itself be fractional and a fractional day of effort multiplies it,
 * so the product has a tail nobody reads past the hundredth.
 *
 * Unitless like `formatDays`: the `currency` label is the caller's business, and
 * it belongs to a header or a field label rather than repeated in every cell.
 * Nothing here converts, and nothing picks a locale's symbol.
 */
export function formatMoney(amount: number): string {
  return moneyFormat.format(amount);
}
