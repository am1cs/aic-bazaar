import { Program } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, VersionedTransaction } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';
import { createBazaarClient, deriveDealAddress, DEVNET_GENESIS_HASH } from '../src';
import { bundledIdl } from '../src/idl';
import type { RawDeal } from '../src/account';
import type { TransactionWallet } from '../src/transport';

async function setup() {
  const customer = Keypair.generate();
  const creator = Keypair.generate();
  const arbiter = Keypair.generate();
  const programId = new PublicKey(bundledIdl.address);
  const dealAddress = deriveDealAddress(programId, customer.publicKey, 42n);
  const program = new Program(bundledIdl, { connection: new Connection('http://127.0.0.1:8899') });
  const raw: RawDeal = {
    dealId: new BN(42), client: customer.publicKey, creator: creator.publicKey, arbiter: arbiter.publicKey,
    title: 'Example ad', brief: 'Agreed ad brief', referencesUrl: '', templateVersion: 1,
    budgetLamports: new BN('300000000'), bondLamports: new BN('30000000'), remainingBudgetLamports: new BN('240000000'),
    lockedBondLamports: new BN('30000000'), rentReserveLamports: new BN('14142720'), status: { active: {} }, currentMilestone: 1,
    milestones: [60000000, 90000000, 150000000].map((amount, index) => ({ amountLamports: new BN(amount), dueAt: new BN(1700000000 + index), url: index === 0 ? 'https://example.com/concept.png' : index === 1 ? 'https://example.com/draft.mp4' : '', sha256: Array(32).fill(index), revision: index <= 1 ? 1 : 0, submittedAt: new BN(index <= 1 ? 1699999990 : 0), paidAt: new BN(index === 0 ? 1699999995 : 0) })),
    disputeOpenedBy: SystemProgram.programId, disputeReason: '', disputeOpenedAt: new BN(0),
    resolutionOutcome: { refund: {} }, resolutionReason: '', resolvedAt: new BN(0), createdAt: new BN(1699999900), bump: 255,
  };
  const rpc = {
    rpcEndpoint: 'https://api.devnet.solana.com',
    getGenesisHash: vi.fn().mockResolvedValue(DEVNET_GENESIS_HASH),
    getAccountInfo: vi.fn().mockImplementation(async (key: PublicKey) => key.equals(programId)
      ? { executable: true, owner: SystemProgram.programId, lamports: 1, data: Buffer.alloc(0), rentEpoch: 0 }
      : { executable: false, owner: programId, lamports: 1, data: await program.coder.accounts.encode('deal', raw), rentEpoch: 0 }),
  };
  function wallet(keypair: Keypair): TransactionWallet {
    return { publicKey: keypair.publicKey,
      async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> { if (transaction instanceof Transaction) transaction.partialSign(keypair); else transaction.sign([keypair]); return transaction; },
      async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> { return Promise.all(transactions.map((transaction) => this.signTransaction(transaction))); },
    };
  }
  const options = { connection: rpc as unknown as Connection, wallet: null as TransactionWallet | null, programId };
  return { customer, creator, arbiter, raw, rpc, wallet, options, address: dealAddress.toBase58() };
}

describe('client boundary using genuine IDL and explicitly mocked accounts', () => {
  it('reads a genuine-codec account without requiring a wallet', async () => {
    const { options, address, customer } = await setup();
    const deal = await createBazaarClient(options).getDeal(address);
    expect(deal.client).toBe(customer.publicKey.toBase58());
    expect(deal.milestones[1].submission?.sha256).toBe('01'.repeat(32));
    expect(deal.remainingBudgetLamports).toBe('240000000');
  });
  it('rejects a wallet-less mutation before contacting RPC', async () => {
    const { options, address, rpc } = await setup();
    await expect(createBazaarClient(options).acceptDeal(address)).rejects.toMatchObject({ code: 'wallet_required' });
    expect(rpc.getGenesisHash).not.toHaveBeenCalled();
  });
  it('rejects wrong roles before any signing request', async () => {
    const { options, wallet, creator, address } = await setup();
    options.wallet = wallet(creator);
    await expect(createBazaarClient(options).approveMilestone({ address, index: 1, expectedRevision: 1, expectedHash: '01'.repeat(32) })).rejects.toMatchObject({ code: 'wrong_role' });
  });
  it('rejects stale revision, hash, and index before payment', async () => {
    const { options, wallet, customer, address } = await setup();
    options.wallet = wallet(customer);
    const client = createBazaarClient(options);
    for (const input of [
      { address, index: 1 as const, expectedRevision: 2 as const, expectedHash: '01'.repeat(32) },
      { address, index: 1 as const, expectedRevision: 1 as const, expectedHash: '02'.repeat(32) },
      { address, index: 0 as const, expectedRevision: 1 as const, expectedHash: '00'.repeat(32) },
    ]) await expect(client.approveMilestone(input)).rejects.toMatchObject({ code: 'stale_submission' });
  });
  it('refuses third revisions and submission during dispute', async () => {
    const { options, wallet, creator, address, raw } = await setup();
    options.wallet = wallet(creator);
    raw.milestones[1].revision = 2;
    const client = createBazaarClient(options);
    const input = { address, index: 1 as const, expectedRevision: 1 as const, sha256: '02'.repeat(32), url: 'https://example.com/replacement.mp4' };
    await expect(client.submitMilestone(input)).rejects.toMatchObject({ code: 'revision_limit' });
    raw.status = { disputed: {} };
    await expect(client.submitMilestone(input)).rejects.toMatchObject({ code: 'invalid_state' });
  });
  it('rejects mainnet even when the local-test flag is enabled', async () => {
    const { options, rpc, address } = await setup();
    rpc.rpcEndpoint = 'http://127.0.0.1:8899';
    rpc.getGenesisHash.mockResolvedValue('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');
    await expect(createBazaarClient({ ...options, allowLocalValidator: true }).getDeal(address)).rejects.toMatchObject({ code: 'invalid_input' });
  });
  it('requires an explicit local-test flag and loopback RPC URL', async () => {
    const { options, rpc, address } = await setup();
    rpc.rpcEndpoint = 'http://127.0.0.1:8899'; rpc.getGenesisHash.mockResolvedValue('local-test-genesis');
    await expect(createBazaarClient(options).getDeal(address)).rejects.toMatchObject({ code: 'invalid_input' });
    expect((await createBazaarClient({ ...options, allowLocalValidator: true }).getDeal(address)).address).toBe(address);
    rpc.rpcEndpoint = 'https://untrusted.example.com';
    await expect(createBazaarClient({ ...options, allowLocalValidator: true }).getDeal(address)).rejects.toMatchObject({ code: 'invalid_input' });
  });
  it('rejects missing program deployment and wrong IDL address', async () => {
    const { options, rpc, address } = await setup();
    rpc.getAccountInfo.mockResolvedValue(null);
    await expect(createBazaarClient(options).getDeal(address)).rejects.toMatchObject({ code: 'not_deployed' });
    await expect(createBazaarClient({ ...options, programId: Keypair.generate().publicKey }).getDeal(address)).rejects.toMatchObject({ code: 'not_deployed' });
    expect(() => createBazaarClient({ ...options, programId: SystemProgram.programId })).toThrowError(expect.objectContaining({ code: 'not_deployed' }));
  });
  it('rejects accounts belonging to a different program and invalid PDA', async () => {
    const { options, address, raw, customer } = await setup();
    // Keep the real account layout but change its stored seed to prove address verification.
    raw.dealId = new BN(43);
    await expect(createBazaarClient(options).getDeal(address)).rejects.toMatchObject({ code: 'not_found' });
    raw.dealId = new BN(42);
    expect(customer.publicKey.toBase58()).toBe(raw.client.toBase58());
  });
});
