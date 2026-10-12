import { PublicKey } from '@solana/web3.js';
import type { Deal, DealStatus, Milestone, Resolution } from '../../shared/api';
import { BazaarSdkError } from './errors';

type Integer = { toString(): string } | number | bigint;
type Enum = Record<string, unknown>;
export interface RawMilestone {
  amountLamports: Integer; dueAt: Integer; url: string; sha256: number[];
  revision: number; submittedAt: Integer; paidAt: Integer;
}
export interface RawDeal {
  dealId: Integer; client: PublicKey; creator: PublicKey; arbiter: PublicKey;
  title: string; brief: string; referencesUrl: string; templateVersion: number;
  budgetLamports: Integer; bondLamports: Integer; remainingBudgetLamports: Integer;
  lockedBondLamports: Integer; rentReserveLamports: Integer; status: Enum;
  currentMilestone: number; milestones: RawMilestone[]; disputeOpenedBy: PublicKey;
  disputeReason: string; disputeOpenedAt: Integer; resolutionOutcome: Enum;
  resolutionReason: string; resolvedAt: Integer; createdAt: Integer; bump: number;
}

const statuses: Record<string, DealStatus> = {
  awaitingCreator: 'awaiting_creator', active: 'active', disputed: 'disputed',
  completed: 'completed', resolved: 'resolved', cancelled: 'cancelled',
};
const resolutions: Record<string, Resolution> = {
  payCurrent: 'pay_current', refund: 'refund', creatorBreach: 'creator_breach',
};
const terminal = new Set<DealStatus>(['completed', 'resolved', 'cancelled']);
function malformed(message: string): never { throw new BazaarSdkError('rpc_error', `Invalid program account: ${message}`); }
function integer(value: Integer, name: string): string {
  const result = value.toString();
  if (!/^\d+$/.test(result)) malformed(`${name} is not an unsigned integer.`);
  return result;
}
function time(value: Integer, name: string): number {
  const result = Number(value.toString());
  if (!Number.isSafeInteger(result) || result < 0) malformed(`${name} is not a valid timestamp.`);
  return result;
}

export function normalizeDeal(address: PublicKey, raw: RawDeal): Deal {
  const status = statuses[Object.keys(raw.status)[0]];
  if (!status || raw.templateVersion !== 1 || raw.milestones.length !== 3) malformed('Unknown state, template, or milestones.');
  if (!terminal.has(status) && ![0, 1, 2].includes(raw.currentMilestone)) malformed('Invalid current milestone.');
  const milestones = raw.milestones.map((entry, index): Milestone => {
    if (![0, 1, 2].includes(entry.revision) || entry.sha256.length !== 32) malformed('Invalid submission.');
    const paidAt = time(entry.paidAt, 'paidAt');
    return {
      index: index as 0 | 1 | 2,
      amountLamports: integer(entry.amountLamports, 'amountLamports'),
      dueAt: time(entry.dueAt, 'dueAt'),
      submission: entry.revision === 0 ? null : {
        url: entry.url,
        sha256: Array.from(entry.sha256, (byte) => byte.toString(16).padStart(2, '0')).join(''),
        revision: entry.revision as 1 | 2,
        submittedAt: time(entry.submittedAt, 'submittedAt'),
      },
      paidAt: paidAt === 0 ? null : paidAt,
    };
  }) as [Milestone, Milestone, Milestone];
  const openedAt = time(raw.disputeOpenedAt, 'disputeOpenedAt');
  const resolvedAt = time(raw.resolvedAt, 'resolvedAt');
  const outcome = resolutions[Object.keys(raw.resolutionOutcome)[0]];
  if (resolvedAt && !outcome) malformed('Unknown resolution outcome.');
  return {
    address: address.toBase58(), client: raw.client.toBase58(), creator: raw.creator.toBase58(), arbiter: raw.arbiter.toBase58(),
    title: raw.title, brief: raw.brief, referencesUrl: raw.referencesUrl, templateVersion: 1,
    budgetLamports: integer(raw.budgetLamports, 'budgetLamports'), bondLamports: integer(raw.bondLamports, 'bondLamports'),
    remainingBudgetLamports: integer(raw.remainingBudgetLamports, 'remainingBudgetLamports'),
    lockedBondLamports: integer(raw.lockedBondLamports, 'lockedBondLamports'), rentReserveLamports: integer(raw.rentReserveLamports, 'rentReserveLamports'),
    status, currentMilestone: terminal.has(status) ? null : raw.currentMilestone as 0 | 1 | 2,
    milestones,
    dispute: openedAt === 0 ? null : { openedBy: raw.disputeOpenedBy.toBase58(), reason: raw.disputeReason, openedAt },
    resolution: resolvedAt === 0 ? null : { outcome, reason: raw.resolutionReason, resolvedAt },
    createdAt: time(raw.createdAt, 'createdAt'),
  };
}
