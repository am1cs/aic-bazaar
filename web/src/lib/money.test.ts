import { describe, expect, it } from 'vitest';
import { calculateAmounts } from '@aic-bazaar/sdk';
import { formatSol, parseSol, splitAmounts } from './money';

describe('exact SOL and lamport conversion', () => {
  it.each([
    ['0.001', '1000000'],
    ['0.001000001', '1000001'],
    ['0.100000009', '100000009'],
    ['1', '1000000000'],
    ['1.000000000', '1000000000'],
    [' 0.0100 ', '10000000'],
  ])('parses %s without rounding', (sol, lamports) => {
    expect(parseSol(sol)).toBe(lamports);
  });

  it.each([
    '', ' ', '0', '0.000999999', '1.000000001', '2', '-0.001', '+0.001',
    '1e-3', 'NaN', 'Infinity', '0,001', '1,000', '.001', '1.', '00.001',
    '0.0010000000', '0 .001', '0.001 SOL', '０.００１',
  ])('rejects an invalid or ambiguous budget %j', (sol) => {
    expect(() => parseSol(sol)).toThrow();
  });

  it.each([
    ['0', '0'], ['1', '0.000000001'], ['1000001', '0.001000001'],
    ['123456789', '0.123456789'], ['1000000000', '1'],
    ['9007199254740993', '9007199.254740993'],
  ])('formats %s lamports exactly', (lamports, sol) => {
    expect(formatSol(lamports)).toBe(sol);
  });

  it.each(['-1', '1.5', '1e9', '01', '', ' 1'])('rejects malformed lamports %j', (lamports) => {
    expect(() => formatSol(lamports)).toThrow();
  });

  it('keeps the rounding remainder in Final', () => {
    expect(splitAmounts('1000001')).toEqual({
      budget: 1000001n, bond: 100000n, milestones: [200000n, 300000n, 500001n],
    });
    expect(splitAmounts('1000009')).toEqual({
      budget: 1000009n, bond: 100000n, milestones: [200001n, 300002n, 500006n],
    });
  });

  it.each(['1000000', '1000001', '1000009', '999999999', '1000000000'])('agrees with the SDK for %s', (lamports) => {
    const result = splitAmounts(lamports);
    expect(result).toEqual(calculateAmounts(lamports));
    expect(result.milestones.reduce((sum, amount) => sum + amount, 0n)).toBe(result.budget);
    expect(parseSol(formatSol(lamports))).toBe(lamports);
  });

  it.each(['0', '999999', '1000000001', '01000000'])('rejects a split outside the agreed budget %s', (lamports) => {
    expect(() => splitAmounts(lamports)).toThrow();
  });
});
