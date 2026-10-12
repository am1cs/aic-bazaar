import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, VersionedTransaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createBazaarClient, type BazaarClient, type Deal, type MutationResult, type Resolution, type TransactionWallet } from '../src';

// Explicit opt-in: normal unit tests never read keys, fund actors, or contact RPC.
const enabled = process.env.AIC_RUN_SDK_INTEGRATION === '1';
const programId = new PublicKey('8ddYBcE1uxzxke9T9ivLqXN9gJiXNY5kGbNYwBfiqCgX');
const budget = 30_000_007n;
const bond = budget / 10n;
const amounts = [6_000_001n, 9_000_002n, 15_000_004n] as const;
const fingerprint = (value: string): string => createHash('sha256').update(value).digest('hex');
const sum = (values: bigint[]): bigint => values.reduce((total, value) => total + value, 0n);

function wallet(keypair: Keypair): TransactionWallet {
  return {
    publicKey: keypair.publicKey,
    async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
      if (transaction instanceof Transaction) transaction.partialSign(keypair);
      else transaction.sign([keypair]);
      return transaction;
    },
    async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
      return Promise.all(transactions.map((transaction) => this.signTransaction(transaction)));
    },
  };
}

describe.skipIf(!enabled).sequential('actual SDK against the compiled local validator program', () => {
  let connection: Connection;
  let customer: Keypair;
  let creator: Keypair;
  let arbiter: Keypair;
  let clients: { customer: BazaarClient; creator: BazaarClient; arbiter: BazaarClient; readOnly: BazaarClient };

  beforeAll(async () => {
    connection = new Connection('http://127.0.0.1:8899', 'confirmed');
    const deployed = await connection.getAccountInfo(programId, 'confirmed');
    expect(deployed?.executable, 'Deploy the actual SBF program to the local validator before running this suite.').toBe(true);
    const payerPath = path.resolve(process.env.AIC_TEST_PAYER ?? '../.local/keys/test-payer.json');
    const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(payerPath, 'utf8'))));
    expect(await connection.getBalance(payer.publicKey, 'confirmed'), 'Ignored local test payer needs at least 0.7 test SOL.').toBeGreaterThan(700_000_000);
    customer = Keypair.generate(); creator = Keypair.generate(); arbiter = Keypair.generate();
    const funding = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: customer.publicKey, lamports: 500_000_000 }),
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: creator.publicKey, lamports: 100_000_000 }),
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: arbiter.publicKey, lamports: 20_000_000 }),
    );
    await sendAndConfirmTransaction(connection, funding, [payer], { commitment: 'confirmed' });
    const options = { connection, programId, allowLocalValidator: true };
    clients = {
      customer: createBazaarClient({ ...options, wallet: wallet(customer) }),
      creator: createBazaarClient({ ...options, wallet: wallet(creator) }),
      arbiter: createBazaarClient({ ...options, wallet: wallet(arbiter) }),
      readOnly: createBazaarClient({ ...options, wallet: null }),
    };
  }, 30_000);

  const balances = async (address?: string): Promise<bigint[]> => {
    const keys = [customer.publicKey, creator.publicKey, arbiter.publicKey, ...(address ? [new PublicKey(address)] : [])];
    return Promise.all(keys.map(async (key) => BigInt(await connection.getBalance(key, 'confirmed'))));
  };
  const actualFee = async (signature: string): Promise<bigint> => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const transaction = await connection.getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
      if (transaction?.meta) {
        expect(transaction.meta.err).toBeNull();
        return BigInt(transaction.meta.fee);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`The confirmed public transaction receipt is unavailable: ${signature}`);
  };
  const receipt = async (result: MutationResult): Promise<{ deal: Deal; fee: bigint }> => {
    expect(result.signature).toBeTruthy();
    expect(result.refreshError).toBeUndefined();
    expect(result.deal).not.toBeNull();
    expect(result.deal!.address).toBe(result.dealAddress);
    console.info(JSON.stringify({ network: 'local-validator', signature: result.signature, dealAddress: result.dealAddress }));
    return { deal: result.deal!, fee: await actualFee(result.signature) };
  };
  const create = async (): Promise<Deal> => {
    const now = Math.floor(Date.now() / 1000);
    const before = await balances();
    const { deal, fee } = await receipt(await clients.customer.createDeal({
      creator: creator.publicKey.toBase58(), arbiter: arbiter.publicKey.toBase58(),
      title: 'SDK integration advertisement', brief: 'A 15-second vertical ad following the approved storyboard.',
      referencesUrl: '', budgetLamports: budget.toString(), deadlines: [now + 3600, now + 7200, now + 10800],
    }));
    const after = await balances(deal.address);
    expect(sum(after)).toBe(sum(before) - fee);
    expect(before[0] - after[0]).toBe(budget + BigInt(deal.rentReserveLamports) + fee);
    expect(after[3]).toBe(budget + BigInt(deal.rentReserveLamports));
    expect(deal.status).toBe('awaiting_creator');
    expect(deal.lockedBondLamports).toBe('0');
    expect(deal.milestones.map((entry) => entry.amountLamports)).toEqual(amounts.map(String));
    expect(await clients.readOnly.getDeal(deal.address)).toEqual(deal);
    return deal;
  };
  const run = async (address: string, operation: () => Promise<MutationResult>) => {
    const before = await balances(address);
    const { deal, fee } = await receipt(await operation());
    const after = await balances(address);
    expect(sum(after)).toBe(sum(before) - fee);
    expect(after[3]).toBe(BigInt(deal.rentReserveLamports) + BigInt(deal.remainingBudgetLamports) + BigInt(deal.lockedBondLamports));
    return { before, after, deal, fee };
  };
  const accept = async (address: string): Promise<void> => {
    const result = await run(address, () => clients.creator.acceptDeal(address));
    expect(result.before[1] - result.after[1]).toBe(bond + result.fee);
    expect(result.deal.status).toBe('active');
    expect(result.deal.lockedBondLamports).toBe(bond.toString());
  };
  const submit = async (address: string, index: 0 | 1 | 2): Promise<string> => {
    const sha256 = fingerprint(`${address}/stage-${index}`);
    const result = await run(address, () => clients.creator.submitMilestone({ address, index, url: `https://example.com/stage-${index}.mp4`, sha256, expectedRevision: 0 }));
    expect(result.deal.milestones[index].submission?.sha256).toBe(sha256);
    expect(result.deal.milestones[index].submission?.revision).toBe(1);
    expect(result.before[1] - result.after[1]).toBe(result.fee);
    return sha256;
  };
  const approve = async (address: string, index: 0 | 1 | 2, expectedHash: string): Promise<Deal> => {
    const result = await run(address, () => clients.customer.approveMilestone({ address, index, expectedRevision: 1, expectedHash }));
    expect(result.after[1] - result.before[1]).toBe(amounts[index] + (index === 2 ? bond : 0n));
    expect(result.before[0] - result.after[0]).toBe(result.fee);
    expect(result.deal.milestones[index].paidAt).not.toBeNull();
    return result.deal;
  };

  it('completes a real three-stage deal and returns the bond with exact rounding', async () => {
    let deal = await create();
    await accept(deal.address);
    for (const index of [0, 1, 2] as const) deal = await approve(deal.address, index, await submit(deal.address, index));
    expect(deal.status).toBe('completed');
    expect(deal.currentMilestone).toBeNull();
    expect(deal.remainingBudgetLamports).toBe('0');
    expect(deal.lockedBondLamports).toBe('0');
    expect(deal.milestones.every((entry) => entry.submission && entry.paidAt)).toBe(true);
    expect(await clients.readOnly.getDeal(deal.address)).toEqual(deal);
  }, 120_000);

  it('cancels an unaccepted deal and refunds budget while retaining account rent', async () => {
    const deal = await create();
    const result = await run(deal.address, () => clients.customer.cancelUnaccepted(deal.address));
    expect(result.after[0] - result.before[0]).toBe(budget - result.fee);
    expect(result.deal.status).toBe('cancelled');
    expect(result.deal.currentMilestone).toBeNull();
    expect(result.deal.remainingBudgetLamports).toBe('0');
    expect(result.after[3]).toBe(BigInt(result.deal.rentReserveLamports));
  }, 120_000);

  for (const outcome of ['pay_current', 'refund', 'creator_breach'] as Resolution[]) {
    it(`settles an actual ${outcome} dispute after the first paid milestone`, async () => {
      const deal = await create();
      await accept(deal.address);
      const paid = await approve(deal.address, 0, await submit(deal.address, 0));
      await submit(deal.address, 1);
      const disputed = await run(deal.address, () => clients.creator.openDispute(deal.address, 'Please review the agreed draft and evidence.'));
      expect(disputed.deal.status).toBe('disputed');
      expect(disputed.deal.dispute?.openedBy).toBe(creator.publicKey.toBase58());
      const resolved = await run(deal.address, () => clients.arbiter.resolveDispute(deal.address, outcome, 'Reviewed the immutable brief and submitted draft.'));
      const remaining = budget - amounts[0];
      const customerRefund = outcome === 'pay_current' ? amounts[2] : outcome === 'creator_breach' ? remaining + bond : remaining;
      const creatorPayout = outcome === 'pay_current' ? amounts[1] + bond : outcome === 'refund' ? bond : 0n;
      expect(resolved.after[0] - resolved.before[0]).toBe(customerRefund);
      expect(resolved.after[1] - resolved.before[1]).toBe(creatorPayout);
      expect(resolved.before[2] - resolved.after[2]).toBe(resolved.fee);
      expect(resolved.deal.status).toBe('resolved');
      expect(resolved.deal.resolution?.outcome).toBe(outcome);
      expect(resolved.deal.resolution?.resolvedAt).toBeGreaterThan(0);
      expect(resolved.deal.currentMilestone).toBeNull();
      expect(resolved.deal.remainingBudgetLamports).toBe('0');
      expect(resolved.deal.lockedBondLamports).toBe('0');
      expect(resolved.deal.milestones[0]).toEqual(paid.milestones[0]);
      expect(resolved.deal.milestones[1].paidAt !== null).toBe(outcome === 'pay_current');
      expect(await clients.readOnly.getDeal(deal.address)).toEqual(resolved.deal);
    }, 120_000);
  }
});
