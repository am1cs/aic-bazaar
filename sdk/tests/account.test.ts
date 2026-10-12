import BN from 'bn.js';
import { Keypair } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';
import { normalizeDeal, type RawDeal } from '../src/account';

function fixture(): RawDeal {
  return {
    dealId: new BN(42), client: Keypair.generate().publicKey, creator: Keypair.generate().publicKey,
    arbiter: Keypair.generate().publicKey, title: 'Demo', brief: 'Demo terms', referencesUrl: '', templateVersion: 1,
    budgetLamports: new BN('300000000'), bondLamports: new BN('30000000'), remainingBudgetLamports: new BN('240000000'),
    lockedBondLamports: new BN('30000000'), rentReserveLamports: new BN('14142720'), status: { active: {} }, currentMilestone: 1,
    milestones: [60000000, 90000000, 150000000].map((amount, index) => ({ amountLamports: new BN(amount), dueAt: new BN(1700000000 + index), url: index === 0 ? 'https://example.com/concept.png' : '', sha256: Array(32).fill(index), revision: index === 0 ? 2 : 0, submittedAt: new BN(index === 0 ? 1699999990 : 0), paidAt: new BN(index === 0 ? 1699999995 : 0) })),
    disputeOpenedBy: Keypair.generate().publicKey, disputeReason: '', disputeOpenedAt: new BN(0),
    resolutionOutcome: { refund: {} }, resolutionReason: '', resolvedAt: new BN(0), createdAt: new BN(1699999900), bump: 255,
  };
}

describe('account normalization', () => {
  it('uses exact integerstrings, epochseconds, and null absent records', () => {
    const raw = fixture();
    const deal = normalizeDeal(Keypair.generate().publicKey, raw);
    expect(deal.budgetLamports).toBe('300000000');
    expect(deal.status).toBe('active');
    expect(deal.currentMilestone).toBe(1);
    expect(deal.milestones[0].submission).toEqual({ url: 'https://example.com/concept.png', sha256: '00'.repeat(32), revision: 2, submittedAt: 1699999990 });
    expect(deal.milestones[0].paidAt).toBe(1699999995);
    expect(deal.milestones[1].submission).toBeNull();
    expect(deal.milestones[1].paidAt).toBeNull();
    expect(deal.dispute).toBeNull();
    expect(deal.resolution).toBeNull();
  });
  it('retains paidmaterial after resolutionand normalizes enum names', () => {
    const raw = fixture();
    raw.status = { resolved: {} }; raw.currentMilestone = 3;
    raw.disputeReason = 'Draft mismatch'; raw.disputeOpenedAt = new BN(1700000020);
    raw.resolutionOutcome = { creatorBreach: {} }; raw.resolutionReason = 'Creator abandoned the agreed draft'; raw.resolvedAt = new BN(1700000030);
    const deal = normalizeDeal(Keypair.generate().publicKey, raw);
    expect(deal.currentMilestone).toBeNull();
    expect(deal.resolution?.outcome).toBe('creator_breach');
    expect(deal.milestones[0].submission).not.toBeNull();
    expect(deal.dispute?.openedAt).toBe(1700000020);
  });
  it('rejects malformed states and unsafe timestamps', () => {
    const raw = fixture(); raw.createdAt = new BN('9007199254740992');
    expect(() => normalizeDeal(Keypair.generate().publicKey, raw)).toThrow();
    raw.createdAt = new BN(1); raw.status = { imaginary: {} };
    expect(() => normalizeDeal(Keypair.generate().publicKey, raw)).toThrow();
  });
});
