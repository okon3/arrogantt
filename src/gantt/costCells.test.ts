import { describe, expect, it } from 'vitest';
import { costCellText, rateCellText } from './costCells';

describe('rateCellText', () => {
  it('is empty on a summary', () => {
    const cell = rateCellText({ dailyRates: [600], isSummary: true, isMilestone: false });
    expect(cell).toEqual({ text: '', title: null, derived: false });
  });

  it('is empty on a milestone', () => {
    const cell = rateCellText({ dailyRates: [], isSummary: false, isMilestone: true });
    expect(cell).toEqual({ text: '', title: null, derived: false });
  });

  it('shows an em dash, derived, when the leaf has no rates', () => {
    const cell = rateCellText({ dailyRates: [], isSummary: false, isMilestone: false });
    expect(cell).toEqual({ text: '—', title: null, derived: true });
  });

  it('shows one figure for a single rate', () => {
    const cell = rateCellText({ dailyRates: [600], isSummary: false, isMilestone: false });
    expect(cell).toEqual({ text: '600', title: null, derived: false });
  });

  it('shows a range for two rates', () => {
    const cell = rateCellText({ dailyRates: [600, 650], isSummary: false, isMilestone: false });
    expect(cell).toEqual({ text: '600–650', title: null, derived: false });
  });

  it('shows the min–max for three or more rates, not every distinct value', () => {
    const cell = rateCellText({
      dailyRates: [400, 600, 650],
      isSummary: false,
      isMilestone: false,
    });
    expect(cell).toEqual({ text: '400–650', title: null, derived: false });
  });
});

describe('costCellText', () => {
  it('is empty when effortDays is 0', () => {
    const cell = costCellText({
      effortDays: 0,
      cost: null,
      uncostedDays: 0,
      resourceName: null,
    });
    expect(cell).toEqual({ text: '', title: null, derived: false });
  });

  it('shows an em dash, derived, titled "No resource" when cost is null and no resource is assigned', () => {
    const cell = costCellText({
      effortDays: 2,
      cost: null,
      uncostedDays: 2,
      resourceName: null,
    });
    expect(cell).toEqual({ text: '—', title: 'No resource', derived: true });
  });

  it('shows an em dash, derived, naming the resource when cost is null with a name', () => {
    const cell = costCellText({
      effortDays: 3,
      cost: null,
      uncostedDays: 3,
      resourceName: 'Marta',
    });
    expect(cell).toEqual({
      text: '—',
      title: 'No rate for Marta on these days',
      derived: true,
    });
  });

  it('shows a lower bound titled with the uncosted days when partially costed', () => {
    const cell = costCellText({
      effortDays: 12,
      cost: 12500,
      uncostedDays: 7,
      resourceName: null,
    });
    expect(cell).toEqual({
      text: '≥ 12,500',
      title: '7 d of effort not costed',
      derived: false,
    });
  });

  it('shows the plain figure when fully costed', () => {
    const cell = costCellText({
      effortDays: 4,
      cost: 12500,
      uncostedDays: 0,
      resourceName: null,
    });
    expect(cell).toEqual({ text: '12,500', title: null, derived: false });
  });

  it('formats to two decimals, grouped — pinning formatMoney at this boundary', () => {
    const cell = costCellText({
      effortDays: 0.25,
      cost: 162.5,
      uncostedDays: 0,
      resourceName: null,
    });
    expect(cell).toEqual({ text: '162.5', title: null, derived: false });
  });
});
