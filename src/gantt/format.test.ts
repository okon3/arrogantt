import { describe, expect, it } from 'vitest';
import { formatDays, formatMoney } from './format';

describe('formatDays', () => {
  it('prints a whole number of days without decimals', () => {
    expect(formatDays(1)).toBe('1');
    expect(formatDays(2)).toBe('2');
    expect(formatDays(9)).toBe('9');
  });

  it('keeps the fraction the editor can produce', () => {
    expect(formatDays(0.25)).toBe('0.25');
    expect(formatDays(0.5)).toBe('0.5');
    expect(formatDays(2.75)).toBe('2.75');
  });

  it('drops the trailing zero of a fraction that ends in one', () => {
    expect(formatDays(1.5)).toBe('1.5');
    expect(formatDays(4.1)).toBe('4.1');
  });

  it('shows nothing for a task with no effort at all', () => {
    expect(formatDays(0)).toBe('0');
  });

  it('hides the noise a rollup picks up from floating point', () => {
    // 0.25 + 0.5 in minutes and back is not exactly 0.75 on every axis.
    expect(formatDays(0.7500000000000001)).toBe('0.75');
    expect(formatDays(8.999999999999998)).toBe('9');
  });

  it('rounds a duration that no number of days divides evenly', () => {
    // Three tasks sharing one person for a day each: 8/3 working days.
    expect(formatDays(8 / 3)).toBe('2.67');
  });
});

describe('formatMoney', () => {
  it('groups the thousands of a figure nobody reads digit by digit', () => {
    expect(formatMoney(12500)).toBe('12,500');
    expect(formatMoney(7800)).toBe('7,800');
  });

  it('keeps the fraction a part-day of effort produces, to two decimals', () => {
    expect(formatMoney(162.5)).toBe('162.5');
    expect(formatMoney(2133.3333333)).toBe('2,133.33');
  });

  it('writes the number and nothing else, the currency label belongs to the caller', () => {
    expect(formatMoney(0)).toBe('0');
    expect(formatMoney(600)).toBe('600');
  });
});
