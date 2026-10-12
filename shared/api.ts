/** Shared v1 boundary. Edit only through a PR reviewed by both participants. */
export type Address = string;
export type Lamports = string;
export type Sha256 = string;
export type MilestoneIndex = 0 | 1 | 2;
export type DealStatus = 'awaiting_creator' | 'active' | 'disputed' | 'completed' | 'resolved' | 'cancelled';
export type Resolution = 'pay_current' | 'refund' | 'creator_breach';

export interface Milestone {
  index: MilestoneIndex;
  amountLamports: Lamports;
  dueAt: number;
  submission: null | { url: string; sha256: Sha256; revision: 1 | 2; submittedAt: number };
  paidAt: number | null;
}

export interface Deal {
  address: Address;
  client: Address;
  creator: Address;
  arbiter: Address;
  title: string;
  brief: string;
  referencesUrl: string;
  templateVersion: 1;
  budgetLamports: Lamports;
  bondLamports: Lamports;
  remainingBudgetLamports: Lamports;
  lockedBondLamports: Lamports;
  rentReserveLamports: Lamports;
  status: DealStatus;
  currentMilestone: MilestoneIndex | null;
  milestones: [Milestone, Milestone, Milestone];
  dispute: null | { openedBy: Address; reason: string; openedAt: number };
  resolution: null | { outcome: Resolution; reason: string; resolvedAt: number };
  createdAt: number;
}

export interface CreateDealInput {
  creator: Address;
  arbiter: Address;
  title: string;
  brief: string;
  referencesUrl: string;
  budgetLamports: Lamports;
  deadlines: [number, number, number];
}

export interface MutationResult {
  /** A transaction confirmed by the configured Devnet RPC. */
  signature: string;
  dealAddress: Address;
  /** Null only if the transaction confirmed but the subsequent read failed. */
  deal: Deal | null;
  refreshError?: string;
}

export interface BazaarClient {
  getDeal(address: Address): Promise<Deal>;
  createDeal(input: CreateDealInput): Promise<MutationResult>;
  acceptDeal(address: Address): Promise<MutationResult>;
  submitMilestone(input: {
    address: Address;
    index: MilestoneIndex;
    url: string;
    sha256: Sha256;
    expectedRevision: 0 | 1;
  }): Promise<MutationResult>;
  approveMilestone(input: {
    address: Address;
    index: MilestoneIndex;
    expectedRevision: 1 | 2;
    expectedHash: Sha256;
  }): Promise<MutationResult>;
  openDispute(address: Address, reason: string): Promise<MutationResult>;
  resolveDispute(address: Address, outcome: Resolution, reason: string): Promise<MutationResult>;
  cancelUnaccepted(address: Address): Promise<MutationResult>;
}

export type BazaarErrorCode =
  | 'wallet_required' | 'wrong_role' | 'invalid_input' | 'invalid_state'
  | 'stale_submission' | 'revision_limit' | 'insufficient_funds' | 'user_rejected'
  | 'rpc_error' | 'transaction_failed' | 'not_found' | 'not_deployed';

export interface BazaarError extends Error {
  code: BazaarErrorCode;
  signature?: string;
  outcomeUnknown?: boolean;
}
