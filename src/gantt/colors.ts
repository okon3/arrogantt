export const DEFAULT_BAR_COLOR = '#3b74d6';

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export type ColorOption = { key: string; label: string };
export type Scheme = 'light' | 'dark';

/**
 * The swatches the task and person pickers offer, one set per scheme.
 *
 * Only the offer follows the scheme: a picked hex is stored as-is and painted
 * as-is in either scheme, never swapped for its twin (the user's call — a
 * colour once chosen does not change under you). So each set has to read on
 * its own scheme's rows only, which is what frees the light set to be deeper
 * and the dark one paler than a single set that served both.
 *
 * Seven OKLCH hues ~51° apart, each at a deep and a pale tier (the Tableau 20
 * structure: past ~8 categories hue alone stops separating, lightness has to
 * help), chosen to maximise the smallest CIEDE2000 distance within each set.
 * Every tint clears 3:1 (WCAG non-text) on its scheme's rows, and 4.5:1
 * against the badge ink `needsDarkInk` gives it. `DEFAULT_BAR_COLOR` stays
 * outside the sets: it is what an uncoloured bar is painted, and moving it
 * would repaint every existing project.
 */
export const COLOR_SETS: Record<Scheme, readonly ColorOption[]> = {
  light: [
    { key: '#0b51b4', label: 'Blue' },
    { key: '#5a8cda', label: 'Sky' },
    { key: '#75329c', label: 'Purple' },
    { key: '#a574c6', label: 'Lilac' },
    { key: '#9d1851', label: 'Wine' },
    { key: '#cb6786', label: 'Pink' },
    { key: '#884202', label: 'Rust' },
    { key: '#c87337', label: 'Orange' },
    { key: '#605a06', label: 'Olive' },
    { key: '#999016', label: 'Mustard' },
    { key: '#036a3d', label: 'Green' },
    { key: '#38a36a', label: 'Mint' },
    { key: '#0f636e', label: 'Teal' },
    { key: '#009eaf', label: 'Aqua' },
    // The one neutral, for a bar meant to recede; outside the ΔE figure.
    { key: '#6b7789', label: 'Grey' },
  ],
  dark: [
    { key: '#4e85dc', label: 'Blue' },
    { key: '#97bfff', label: 'Sky' },
    { key: '#a16ac6', label: 'Purple' },
    { key: '#d4aaf3', label: 'Lilac' },
    { key: '#ca5c7f', label: 'Wine' },
    { key: '#f99fb8', label: 'Pink' },
    { key: '#c7691e', label: 'Rust' },
    { key: '#f6aa79', label: 'Orange' },
    { key: '#928908', label: 'Olive' },
    { key: '#c8c26a', label: 'Mustard' },
    { key: '#159f60', label: 'Green' },
    { key: '#7fd3a0', label: 'Mint' },
    { key: '#0d97a7', label: 'Teal' },
    { key: '#57d2e2', label: 'Aqua' },
    { key: '#8a94a3', label: 'Grey' },
  ],
};

/** A swatch's name from either set: a colour picked under the other scheme is still named. */
export function colorLabel(hex: string): string | undefined {
  const wanted = hex.toLowerCase();
  return [...COLOR_SETS.light, ...COLOR_SETS.dark].find((option) => option.key === wanted)?.label;
}

/**
 * Near-black, the same figure as `--on-accent`'s dark-mode ink
 * (`index.css`) — chosen for the same reason: white ink loses contrast
 * fast as a fill lightens, and a near-black (rather than a mid-grey) keeps
 * a badge legible right up to the point a tint is light enough for white to
 * fail, closing the gap between "white wins" and "dark wins" instead of
 * leaving tints in between illegible either way.
 */
const BADGE_DARK_INK = '#0a0c12';

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * WCAG relative luminance (the basis of the 4.5:1/3:1 contrast ratios), or
 * null for anything that is not a `#rrggbb` colour.
 */
function relativeLuminance(hex: string): number | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  const r = srgbToLinear((value >> 16) & 255);
  const g = srgbToLinear((value >> 8) & 255);
  const b = srgbToLinear(value & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA: string, hexB: string): number | null {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  if (a === null || b === null) return null;
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Does a badge painted on this fill need dark ink instead of white?
 *
 * Answers by contrast, not by a fixed lightness threshold: computes both
 * options and returns whichever wins. Used for `seg-pct`, the allocation
 * badge that sits directly on a task's own colour (`segmentBar.ts`) — the
 * one place a bar's fill has to carry legible text, so the badge adapts
 * instead of the palette being capped to stay white-legible.
 */
export function needsDarkInk(fill: string): boolean {
  const onDark = contrastRatio(fill, BADGE_DARK_INK);
  const onWhite = contrastRatio(fill, '#ffffff');
  // A fill we cannot read keeps white, the ink every badge carried before this
  // adapted: a guessed luminance puts near-black on what may well be a dark
  // colour, and the agent API accepts hexes the file format's gate refuses.
  if (onDark === null || onWhite === null) return false;
  return onDark > onWhite;
}

/**
 * Avatar colours, picked by name so the same person keeps the same colour
 * across sessions without storing one.
 *
 * Muted on purpose, and picked to keep a CIEDE2000 distance from each other
 * and from every swatch in both `COLOR_SETS` (and the default blue): an avatar
 * reads as a person, never as a task's colour. White initials stay legible.
 */
const AVATAR_COLORS = [
  '#6e5755',
  '#797d69',
  '#4f4f6d',
  '#8f788b',
  '#4b5646',
  '#856947',
  '#a9655a',
  '#805175',
];

export function avatarColorOf(person: { name: string; color?: string }): string {
  // Their own colour when they have one: a person reads as one colour, on
  // their face, their lane and the bars that are theirs alone.
  if (person.color) return person.color;
  const { name } = person;
  let hash = 0;
  for (let index = 0; index < name.length; index++) {
    hash = (hash * 31 + name.charCodeAt(index)) % 100_000;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * A resource id as a class token, carried by every row, bar and link that
 * person appears on, and by their lane in the load panel.
 *
 * Ids come from the file and may hold anything, a space included, which would
 * split into two class names. The escape is injective — the escape character
 * escapes itself — so two people can never land on the same class.
 */
export function resourceClass(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9-]/g, (char) => `_${char.charCodeAt(0).toString(16)}_`);
  return `gantt-res-${safe}`;
}

/** Up to two initials, so "Marta Rossi" reads as MR and "Marta" as M. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  return (words.length > 1 ? first + words[words.length - 1][0] : first).toUpperCase();
}

/**
 * Darkens a hex colour, for a border, an outline, or the flatter shade a
 * summary takes.
 *
 * Here rather than in the chart because the printable figure paints the same
 * bars: one rule for what a darker shade of a task's colour is.
 */
export function shade(hex: string, factor = 0.72): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const value = Number.parseInt(match[1], 16);
  const channel = (shift: number) => Math.round(((value >> shift) & 255) * factor);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}
