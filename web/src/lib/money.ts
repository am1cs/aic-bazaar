const LAMPORTS_PER_SOL = 1_000_000_000n;
export const MIN_BUDGET_LAMPORTS = 1_000_000n;
export const MAX_BUDGET_LAMPORTS = LAMPORTS_PER_SOL;

function integerLamports(value: string): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error('Lamports must be an unsigned decimal integer without leading zeros.');
  }
  return BigInt(value);
}

function demoBudget(value: bigint): bigint {
  if (value < MIN_BUDGET_LAMPORTS || value > MAX_BUDGET_LAMPORTS) {
    throw new Error('Budget must be between 0.001 and 1 SOL.');
  }
  return value;
}

/** Parse a complete decimal SOL input using integer arithmetic only. */
export function parseSol(value: string): string {
  const input = typeof value === 'string' ? value.trim() : '';
  if (!/^(0|[1-9]\d*)(?:\.\d{1,9})?$/.test(input)) {
    throw new Error('Enter a complete decimal SOL amount with at most 9 decimal places; signs, commas, and exponents are not accepted.');
  }
  const [whole, fraction = ''] = input.split('.');
  const lamports = BigInt(whole) * LAMPORTS_PER_SOL + BigInt(fraction.padEnd(9, '0'));
  return demoBudget(lamports).toString();
}

/** Format any nonnegative lamport amount, including zero and rent, exactly. */
export function formatSol(lamports: string): string {
  const amount = integerLamports(lamports);
  const whole = amount / LAMPORTS_PER_SOL;
  const fraction = (amount % LAMPORTS_PER_SOL).toString().padStart(9, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function splitAmounts(lamports: string): {
  budget: bigint;
  bond: bigint;
  milestones: [bigint, bigint, bigint];
} {
  const budget = demoBudget(integerLamports(lamports));
  const concept = budget * 20n / 100n;
  const draft = budget * 30n / 100n;
  return { budget, bond: budget / 10n, milestones: [concept, draft, budget - concept - draft] };
}
