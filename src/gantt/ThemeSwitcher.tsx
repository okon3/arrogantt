import { useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { DraftStorage } from './draft';
import { readThemeChoice, setThemeChoice, type ThemeChoice } from './theme';

const CHOICES: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'auto', label: 'Auto (follows the system)', Icon: Monitor },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

export function ThemeSwitcher({ storage }: { storage: DraftStorage | undefined }) {
  const [choice, setChoice] = useState(() => readThemeChoice(storage));
  return (
    // Shows the choice in force; pointing at it (or tabbing in) opens the others
    // beside it, leftwards, over the header rather than pushing it.
    <div className="theme-switch" role="group" aria-label="Theme">
      <div className="theme-switch__track">
        {CHOICES.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            className="theme-switch__option"
            title={label}
            aria-label={label}
            aria-pressed={choice === value}
            onClick={() => {
              setThemeChoice(storage, value);
              setChoice(value);
            }}
          >
            <Icon size={13} />
          </button>
        ))}
      </div>
    </div>
  );
}
