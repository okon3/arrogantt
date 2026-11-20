import { describe, expect, it } from 'vitest';
import { offersAction } from './rowMenuActions';

const leaf = { isSummary: false, isMilestone: false };
const summary = { isSummary: true, isMilestone: false };
const milestone = { isSummary: false, isMilestone: true };

describe('row menu actions', () => {
  it('offers a pace on a leaf with effort only', () => {
    expect(offersAction('pace', leaf)).toBe(true);
    expect(offersAction('pace', summary)).toBe(false);
    expect(offersAction('pace', milestone)).toBe(false);
  });

  it('closes gaps on a summary only', () => {
    expect(offersAction('close-gaps', summary)).toBe(true);
    expect(offersAction('close-gaps', leaf)).toBe(false);
  });

  it('creates from any row', () => {
    for (const target of [leaf, summary, milestone]) {
      expect(offersAction('sibling', target)).toBe(true);
    }
  });
});
