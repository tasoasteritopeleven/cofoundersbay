import { describe, expect, it } from 'vitest';
import { formatCompactMoney } from './format';

describe('formatCompactMoney', () => {
  it('writes the same suffix whatever the ICU data says', () => {
    expect(formatCompactMoney(500_000)).toBe('€500K');
    expect(formatCompactMoney(1_000_000)).toBe('€1M');
    expect(formatCompactMoney(2_500_000_000)).toBe('€3B');
    expect(formatCompactMoney(950)).toBe('€950');
  });

  it('keeps the requested fraction digits', () => {
    expect(formatCompactMoney(1_500_000, 'EUR', 1)).toBe('€1.5M');
    expect(formatCompactMoney(1_000_000, 'EUR', 1)).toBe('€1M');
  });

  it('carries a rounding overflow into the next tier', () => {
    expect(formatCompactMoney(999_600)).toBe('€1M');
  });

  it('uses the currency it is given, and signs negatives', () => {
    expect(formatCompactMoney(200_000, 'USD')).toBe('$200K');
    expect(formatCompactMoney(-75_000, 'GBP')).toBe('-£75K');
  });
});
