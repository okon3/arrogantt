import { useSyncExternalStore } from 'react';
import type { DraftStorage } from './draft';

export type ThemeChoice = 'light' | 'auto' | 'dark';

/** Also read by the inline script in `index.html`, which paints the first frame. */
const THEME_KEY = 'arrogantt.theme.v1';

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)');

export function readThemeChoice(storage: DraftStorage | undefined): ThemeChoice {
  try {
    const stored = storage?.getItem(THEME_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

let current: ThemeChoice = 'auto';
const listeners = new Set<() => void>();

/** The scheme on screen now, whatever the choice that resolved to it. */
export function currentScheme(): 'light' | 'dark' {
  return document.documentElement.dataset.scheme === 'dark' ? 'dark' : 'light';
}

function subscribeScheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The scheme on screen, re-rendering when a choice or the system flips it. */
export function useScheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribeScheme, currentScheme);
}

/**
 * Puts the resolved scheme on the root element: `data-scheme` for the app's
 * stylesheets, `data-gantt-theme` for dhtmlx v10, which keys its own dark theme
 * off that attribute.
 */
function apply(): void {
  const dark = current === 'dark' || (current === 'auto' && systemDark().matches);
  const root = document.documentElement;
  root.dataset.scheme = dark ? 'dark' : 'light';
  // Removed rather than set to the light theme's name: absent is what dhtmlx
  // treats as its default, and naming it would pin us to that default's name.
  if (dark) root.dataset.ganttTheme = 'dark';
  else delete root.dataset.ganttTheme;
  listeners.forEach((listener) => listener());
}

/**
 * Called once at startup, outside React: it must not depend on a render, and
 * the listener lives as long as the document does.
 */
export function installTheme(storage: DraftStorage | undefined): void {
  current = readThemeChoice(storage);
  apply();
  systemDark().addEventListener('change', apply);
}

/** A view preference, like the columns: never in the `.gantt` file, no undo. */
export function setThemeChoice(storage: DraftStorage | undefined, choice: ThemeChoice): void {
  current = choice;
  apply();
  try {
    if (choice === 'auto') storage?.removeItem(THEME_KEY);
    else storage?.setItem(THEME_KEY, choice);
  } catch {
    // Storage refused: the choice holds for this session only.
  }
}
