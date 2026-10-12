import { describe, expect, it } from 'vitest';
import { Keypair } from '@solana/web3.js';
import type { Deal, DealStatus } from '../../../shared/api';
import { capabilities, roleFor } from './permissions';

const client = Keypair.generate().publicKey.toBase58();
const creator = Keypair.generate().publicKey.toBase58();
const arbiter = Keypair.generate().publicKey.toBase58();
const viewer = Keypair.generate().publicKey.toBase58();
const none = { accept: false, cancel: false, submit: false, replace: false, approve: false, dispute: false, resolve: false, payCurrent: false };

function deal(status: DealStatus = 'active'): Deal {
  return {
    address: Keypair.generate().publicKey.toBase58(), client, creator, arbiter,
    title: 'Test terms', brief: 'Test brief', referencesUrl: '', templateVersion: 1,
    budgetLamports: '1000001', bondLamports: '100000', remainingBudgetLamports: '1000001',
    lockedBondLamports: '100000', rentReserveLamports: '1', status, currentMilestone: 0,
    milestones: [
      { index: 0, amountLamports: '200000', dueAt: 1, submission: null, paidAt: null },
      { index: 1, amountLamports: '300000', dueAt: 2, submission: null, paidAt: null },
      { index: 2, amountLamports: '500001', dueAt: 3, submission: null, paidAt: null },
    ],
    dispute: null, resolution: null, createdAt: 0,
  };
}

function addSubmission(value: Deal, revision: 1 | 2 = 1): Deal {
  value.milestones[value.currentMilestone!].submission = {
    url: 'https://example.com/material', sha256: 'a'.repeat(64), revision, submittedAt: 1,
  };
  return value;
}

describe('wallet roles and capabilities', () => {
  it('recomputes the role for connected, changed, unrelated, and disconnected wallets', () => {
    const value = deal();
    expect(roleFor(value, client)).toBe('client');
    expect(roleFor(value, creator)).toBe('creator');
    expect(roleFor(value, arbiter)).toBe('arbiter');
    expect(roleFor(value, viewer)).toBe('viewer');
    expect(roleFor(value, null)).toBe('viewer');
    expect(roleFor(value)).toBe('viewer');
  });

  it('permits only acceptance or cancellation before creator acceptance', () => {
    const value = deal('awaiting_creator');
    expect(capabilities(value, creator)).toEqual({ ...none, accept: true });
    expect(capabilities(value, client)).toEqual({ ...none, cancel: true });
    expect(capabilities(value, arbiter)).toEqual(none);
  });

  it('permits the initial submission and either-party dispute before a submission exists', () => {
    const value = deal();
    expect(capabilities(value, creator)).toEqual({ ...none, submit: true, dispute: true });
    expect(capabilities(value, client)).toEqual({ ...none, dispute: true });
    expect(capabilities(value, arbiter)).toEqual(none);
  });

  it('permits one replacement and current-stage approval for revision 1', () => {
    const value = addSubmission(deal());
    expect(capabilities(value, creator)).toEqual({ ...none, replace: true, dispute: true });
    expect(capabilities(value, client)).toEqual({ ...none, approve: true, dispute: true });
  });

  it('disables a third submission while keeping revision 2 approval available', () => {
    const value = addSubmission(deal(), 2);
    expect(capabilities(value, creator)).toEqual({ ...none, dispute: true });
    expect(capabilities(value, client)).toEqual({ ...none, approve: true, dispute: true });
  });

  it('does not approve or replace an already paid stage or an old stage submission', () => {
    const value = addSubmission(deal());
    value.milestones[0].paidAt = 10;
    expect(capabilities(value, creator)).toEqual({ ...none, dispute: true });
    expect(capabilities(value, client)).toEqual({ ...none, dispute: true });
    value.currentMilestone = 1;
    expect(capabilities(value, creator)).toEqual({ ...none, submit: true, dispute: true });
    expect(capabilities(value, client)).toEqual({ ...none, dispute: true });
    addSubmission(value);
    expect(capabilities(value, client).approve).toBe(true);
  });

  it('freezes normal actions when disputed and restricts resolution to the arbiter', () => {
    const value = deal('disputed');
    expect(capabilities(value, client)).toEqual(none);
    expect(capabilities(value, creator)).toEqual(none);
    expect(capabilities(value, arbiter)).toEqual({ ...none, resolve: true });
    addSubmission(value);
    expect(capabilities(value, arbiter)).toEqual({ ...none, resolve: true, payCurrent: true });
    value.milestones[0].paidAt = 10;
    expect(capabilities(value, arbiter)).toEqual({ ...none, resolve: true });
  });

  it.each<DealStatus>(['completed', 'resolved', 'cancelled'])('disables every mutation in terminal state %s with a null current stage', (status) => {
    const value = addSubmission(deal(status));
    value.currentMilestone = null;
    for (const wallet of [client, creator, arbiter, viewer, undefined]) {
      expect(capabilities(value, wallet)).toEqual(none);
    }
  });

  it.each<DealStatus>(['awaiting_creator', 'active', 'disputed', 'completed', 'resolved', 'cancelled'])('keeps disconnected and unrelated wallets read-only in %s', (status) => {
    const value = addSubmission(deal(status));
    expect(capabilities(value, viewer)).toEqual(none);
    expect(capabilities(value, undefined)).toEqual(none);
    expect(capabilities(value, null)).toEqual(none);
  });

  it('handles an absent current stage without dereferencing it', () => {
    const value = deal();
    value.currentMilestone = null;
    expect(capabilities(value, creator)).toEqual({ ...none, dispute: true });
    expect(capabilities(value, client)).toEqual({ ...none, dispute: true });
    value.status = 'disputed';
    expect(capabilities(value, arbiter)).toEqual({ ...none, resolve: true });
  });
});
