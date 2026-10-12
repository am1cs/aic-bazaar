import { PublicKey, SystemProgram } from '@solana/web3.js';
import type { CreateDealInput, MilestoneIndex, Resolution } from '../../shared/api';
import { BazaarSdkError } from './errors';

export const MIN_BUDGET = 1_000_000n;
export const MAX_BUDGET = 1_000_000_000n;
const encoder = new TextEncoder();

export function invalid(message: string): never { throw new BazaarSdkError('invalid_input', message); }

export function publicKey(value: string | PublicKey, name = 'Address'): PublicKey {
  try { return value instanceof PublicKey ? value : new PublicKey(value); }
  catch { return invalid(`${name} must be a valid Solana address.`); }
}

export function participant(value: string | PublicKey, name: string): PublicKey {
  const key = publicKey(value, name);
  if (key.equals(SystemProgram.programId) || !PublicKey.isOnCurve(key.toBytes())) invalid(`${name} must be a non-default wallet address capable of signing.`);
  return key;
}

export function text(value: string, name: string, maxBytes: number, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) invalid(`${name} must not be blank.`);
  if (encoder.encode(value).length > maxBytes) invalid(`${name} must be at most ${maxBytes} UTF-8 bytes.`);
  return value;
}

export function httpsUrl(value: string, name = 'URL', allowEmpty = false): string {
  text(value, name, 200, allowEmpty);
  if (allowEmpty && value === '') return value;
  if (!value.startsWith('https://') || /[\s\\\u0000-\u001f\u007f-\u009f]/.test(value)) invalid(`${name} must be a lowercase HTTPS URL without spaces, control characters, or backslashes.`);
  if (value.slice(8).split(/[/?#]/, 1)[0].includes('@')) invalid(`${name} must not contain URL credentials.`);
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || value.trim() !== value) invalid(`${name} must be an HTTPS URL without credentials.`);
  } catch { invalid(`${name} must be a valid HTTPS URL.`); }
  return value;
}

export function lamports(value: string): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) invalid('Budget must be an unsigned base-10 integer lamport string.');
  const amount = BigInt(value);
  if (amount < MIN_BUDGET || amount > MAX_BUDGET) invalid(`Demo budget must be between ${MIN_BUDGET} and ${MAX_BUDGET} lamports.`);
  return amount;
}

export function amounts(budget: string): { budget: bigint; bond: bigint; milestones: [bigint, bigint, bigint] } {
  const value = lamports(budget);
  const concept = value * 20n / 100n;
  const draft = value * 30n / 100n;
  return { budget: value, bond: value / 10n, milestones: [concept, draft, value - concept - draft] };
}

export function milestoneIndex(value: number): MilestoneIndex {
  if (value !== 0 && value !== 1 && value !== 2) invalid('Milestone index must be 0, 1, or 2.');
  return value;
}

export function hash(value: string): number[] {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) invalid('SHA-256 must contain exactly 64 lowercase hexadecimal characters.');
  return Array.from(value.match(/.{2}/g)!, (byte) => parseInt(byte, 16));
}

export function resolution(value: string): Resolution {
  if (value !== 'pay_current' && value !== 'refund' && value !== 'creator_breach') invalid('Unknown dispute outcome.');
  return value;
}

export function validateCreate(input: CreateDealInput, client: PublicKey, now = Math.floor(Date.now() / 1000)) {
  if (!input || typeof input !== 'object') invalid('Deal terms are required.');
  participant(client, 'Customer');
  const creator = participant(input.creator, 'Creator');
  const arbiter = participant(input.arbiter, 'Arbiter');
  if (client.equals(creator) || client.equals(arbiter) || creator.equals(arbiter)) invalid('Customer, creator, and arbiter must be different wallets.');
  text(input.title, 'Title', 64);
  text(input.brief, 'Brief', 200);
  httpsUrl(input.referencesUrl, 'References URL', true);
  lamports(input.budgetLamports);
  if (!Array.isArray(input.deadlines) || input.deadlines.length !== 3 || input.deadlines.some((value) => !Number.isSafeInteger(value))) invalid('Three integer Unix deadlines are required.');
  const [a, b, c] = input.deadlines;
  if (!(now < a && a < b && b < c)) invalid('Deadlines must be increasing future Unix timestamps.');
  return { creator, arbiter };
}
