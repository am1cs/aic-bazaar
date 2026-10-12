import type { Deal } from '../../../shared/api';

export type DealRole = 'client' | 'creator' | 'arbiter' | 'viewer';

export interface DealCapabilities {
  accept: boolean;
  cancel: boolean;
  submit: boolean;
  replace: boolean;
  approve: boolean;
  dispute: boolean;
  resolve: boolean;
  payCurrent: boolean;
}

export function roleFor(deal: Deal, walletAddress?: string | null): DealRole {
  if (!walletAddress) return 'viewer';
  if (walletAddress === deal.client) return 'client';
  if (walletAddress === deal.creator) return 'creator';
  if (walletAddress === deal.arbiter) return 'arbiter';
  return 'viewer';
}

export function capabilities(deal: Deal, walletAddress?: string | null): DealCapabilities {
  const role = roleFor(deal, walletAddress);
  const index = deal.currentMilestone;
  const current = index === 0 || index === 1 || index === 2 ? deal.milestones[index] : undefined;
  const unpaidCurrent = !!current && current.index === index && current.paidAt === null;
  const submittedCurrent = unpaidCurrent && !!current.submission &&
    (current.submission.revision === 1 || current.submission.revision === 2);
  const active = deal.status === 'active';
  const awaiting = deal.status === 'awaiting_creator';
  const resolve = deal.status === 'disputed' && role === 'arbiter';
  return {
    accept: awaiting && role === 'creator',
    cancel: awaiting && role === 'client',
    submit: active && role === 'creator' && unpaidCurrent && current.submission === null,
    replace: active && role === 'creator' && unpaidCurrent && current.submission?.revision === 1,
    approve: active && role === 'client' && submittedCurrent,
    dispute: active && (role === 'client' || role === 'creator'),
    resolve,
    payCurrent: resolve && submittedCurrent,
  };
}
