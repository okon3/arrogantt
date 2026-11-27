import { describe, expect, it } from 'vitest';
import { exportFilename, projectFilename } from './files';

describe('exportFilename', () => {
  it('swaps the project extension', () => {
    expect(exportFilename('progetto.gantt', 'csv')).toBe('progetto.csv');
    expect(exportFilename('Piano 2026.GANTT', 'png')).toBe('Piano 2026.png');
  });

  it('appends to a name carrying no extension', () => {
    expect(exportFilename('progetto', 'csv')).toBe('progetto.csv');
  });

  it('leaves a foreign extension alone rather than guessing at it', () => {
    expect(exportFilename('piano.v2', 'csv')).toBe('piano.v2.csv');
  });
});

describe('projectFilename', () => {
  it('stores the extension exactly once, whatever was typed', () => {
    expect(projectFilename('plan')).toBe('plan.gantt');
    expect(projectFilename('  plan.GANTT ')).toBe('plan.gantt');
  });

  it('renames nothing for a blank name', () => {
    expect(projectFilename('   ')).toBeNull();
    expect(projectFilename('.gantt')).toBeNull();
  });
});
