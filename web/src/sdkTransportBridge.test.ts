// @vitest-environment node
// @vitest-environment node
import { Program } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { Buffer } from 'buffer';
import bs58 from 'bs58';
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, VersionedTransaction } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';
import { createBazaarClient, DEVNET_GENESIS_HASH } from '@aic-bazaar/sdk';
import { bundledIdl } from '../../sdk/src/idl';
import { submitTransaction as originalSubmit, type TransactionWallet } from '../../sdk/src/transport';
import type { Deal } from '../../shared/api';
import deployment from '../../deployment/devnet.json';
import { transportBridgePlugin } from '../transportBridgePlugin';
import { submitTransaction } from './sdkTransportBridge';

function setup() {
  // Synthetic, in-memory keys only. These tests never contact RPC or actual wallets.
  const keypair = Keypair.generate();
  const recipient = Keypair.generate().publicKey;
  const programId = new PublicKey(deployment.programId);
  const observed: Uint8Array[] = [];
  const wallet: TransactionWallet = {
    publicKey: keypair.publicKey,
    async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
      if (!(transaction instanceof Transaction)) throw new Error('Expected legacy transaction');
      // Reproduce Phantom's documented priority-fee enhancement for unsigned TXs.
      if (!transaction.instructions.some((ix) => ix.programId.equals(ComputeBudgetProgram.programId))) {
        transaction.instructions.unshift(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }));
      }
      observed.push(transaction.serializeMessage());
      transaction.partialSign(keypair);
      return transaction;
    },
    async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> { return Promise.all(transactions.map((tx) => this.signTransaction(tx))); },
  };
  const sign = vi.spyOn(wallet, 'signTransaction');
  const rpc = {
    rpcEndpoint: 'https://api.devnet.solana.com',
    getGenesisHash: vi.fn().mockResolvedValue(DEVNET_GENESIS_HASH),
    getAccountInfo: vi.fn().mockImplementation(async (key: PublicKey) => key.equals(programId) ? { executable: true } : null),
    getMinimumBalanceForRentExemption: vi.fn().mockResolvedValue(10_322_560),
    getLatestBlockhash: vi.fn().mockResolvedValue({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 12345 }),
    getFeeForMessage: vi.fn().mockResolvedValue({ value: 5000 }),
    getBalance: vi.fn().mockResolvedValue(1_000_000_000),
    simulateTransaction: vi.fn().mockResolvedValue({ value: { err: null, logs: [] } }),
    sendRawTransaction: vi.fn().mockImplementation(async (raw: Uint8Array) => bs58.encode(Transaction.from(raw).signature!)),
    confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
    getSignatureStatuses: vi.fn().mockResolvedValue({ value: [null] }),
  };
  const instruction = new TransactionInstruction({ programId, keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: true }, { pubkey: recipient, isSigner: false, isWritable: true }], data: Buffer.from([1, 2, 3, 4]) });
  const deal = { address: Keypair.generate().publicKey.toBase58() } as Deal;
  const refresh = vi.fn().mockResolvedValue(deal);
  const options = { connection: rpc as unknown as Connection, wallet, transaction: new Transaction().add(instruction), dealAddress: deal.address, debitLamports: 1n, refresh };
  return { options, rpc, sign, keypair, instruction, observed, programId, refresh, deal };
}

describe('Phantom compatibility with the unmodified SDK transport', () => {
  it('reproduces the original priority enhancement rejection before broadcast', async () => {
    const { options, rpc } = setup();
    await expect(originalSubmit(options)).rejects.toMatchObject({ code: 'transaction_failed', message: 'The wallet changed the transaction message. Nothing was submitted.' });
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled();
  });

  it('prepares fees before simulation and keeps the signed message and wire exact', async () => {
    const { options, rpc, instruction, observed, deal } = setup();
    const originalData = Buffer.from(instruction.data);
    const originalKeys = instruction.keys.map((key) => ({ ...key }));
    const result = await submitTransaction(options);
    const sent = Transaction.from(rpc.sendRawTransaction.mock.calls[0][0]);
    expect(result.deal).toBe(deal);
    expect(options.transaction.instructions).toHaveLength(3);
    expect(options.transaction.instructions[2]).toBe(instruction);
    expect(instruction.data).toEqual(originalData);
    expect(instruction.keys).toEqual(originalKeys);
    expect(sent.serializeMessage()).toEqual(observed[0]);
    expect(sent.verifySignatures()).toBe(true);
    expect(sent.serialize()).toEqual(rpc.sendRawTransaction.mock.calls[0][0]);
    expect(rpc.simulateTransaction.mock.calls[0][0].message.serialize()).toEqual(sent.serializeMessage());
    expect(rpc.getFeeForMessage.mock.calls[0][0].serialize()).toEqual(sent.serializeMessage());
    expect(sent.instructions[0].data).toEqual(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }).data);
    expect(sent.instructions[1].data).toEqual(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 0 }).data);
  });

  it.each(['payer', 'recipient', 'data', 'hash', 'budget', 'extra instruction'] as const)('rejects post-sign %s mutation without broadcasting', async (change) => {
    const { options, rpc, sign, keypair } = setup();
    sign.mockImplementation(async <T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> => {
      if (!(transaction instanceof Transaction)) throw new Error('Expected legacy transaction');
      if (change === 'payer') transaction.feePayer = Keypair.generate().publicKey;
      if (change === 'recipient') transaction.instructions[2].keys[1].pubkey = Keypair.generate().publicKey;
      if (change === 'data') transaction.instructions[2].data[0] ^= 1;
      if (change === 'hash') transaction.recentBlockhash = Keypair.generate().publicKey.toBase58();
      if (change === 'budget') transaction.instructions[1] = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100 });
      if (change === 'extra instruction') transaction.add(SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: Keypair.generate().publicKey, lamports: 1 }));
      transaction.partialSign(keypair);
      return transaction;
    });
    await expect(submitTransaction(options)).rejects.toMatchObject({ code: 'transaction_failed' });
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled();
  });

  it.each(['missing', 'invalid', 'wrong signer'] as const)('rejects a %s signature without broadcasting', async (kind) => {
    const { options, rpc, sign } = setup();
    sign.mockImplementation(async <T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> => {
      if (!(transaction instanceof Transaction)) throw new Error('Expected legacy transaction');
      if (kind === 'invalid') transaction.addSignature(options.wallet.publicKey, Buffer.alloc(64, 1));
      if (kind === 'wrong signer') {
        const other = Keypair.generate();
        const otherTx = Transaction.from(transaction.serialize({ requireAllSignatures: false, verifySignatures: false }));
        otherTx.feePayer = other.publicKey;
        otherTx.partialSign(other);
        transaction.addSignature(options.wallet.publicKey, otherTx.signature!);
      }
      return transaction;
    });
    await expect(submitTransaction(options)).rejects.toMatchObject({ code: kind === 'missing' ? 'user_rejected' : 'transaction_failed' });
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled();
  });

  it.each(['foreign program', 'existing compute budget', 'extra instruction', 'already signed'] as const)('rejects %s before RPC and signing', async (kind) => {
    const { options, rpc, sign } = setup();
    if (kind === 'foreign program') options.transaction.instructions[0].programId = SystemProgram.programId;
    if (kind === 'existing compute budget') options.transaction.instructions.unshift(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 0 }));
    if (kind === 'extra instruction') options.transaction.add(options.transaction.instructions[0]);
    if (kind === 'already signed') options.transaction.signatures.push({ publicKey: options.wallet.publicKey, signature: Buffer.alloc(64, 1) });
    await expect(submitTransaction(options)).rejects.toMatchObject({ code: 'invalid_input' });
    expect(rpc.getLatestBlockhash).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled();
  });

  it.each(['wire size', 'balance', 'simulation'] as const)('keeps SDK %s checks before the wallet prompt', async (kind) => {
    const { options, rpc, sign } = setup();
    if (kind === 'wire size') options.transaction.instructions[0].data = Buffer.alloc(1300);
    if (kind === 'balance') rpc.getBalance.mockResolvedValue(5000);
    if (kind === 'simulation') rpc.simulateTransaction.mockResolvedValue({ value: { err: { InstructionError: [2, { Custom: 6000 }] }, logs: ['Program log: AnchorError. Error Code: WrongRole.'] } });
    await expect(submitTransaction(options)).rejects.toMatchObject({ code: kind === 'wire size' ? 'invalid_input' : kind === 'balance' ? 'insufficient_funds' : 'wrong_role' });
    expect(sign).not.toHaveBeenCalled();
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled();
  });

  it('keeps the known signature and blocks uncertain sending', async () => {
    const { options, rpc, refresh } = setup();
    rpc.sendRawTransaction.mockRejectedValue(new Error('network timeout'));
    await expect(submitTransaction(options)).rejects.toMatchObject({ code: 'rpc_error', signature: expect.any(String), outcomeUnknown: true });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('recovers a confirmed transaction after a lost RPC response', async () => {
    const { options, rpc, deal } = setup();
    rpc.sendRawTransaction.mockRejectedValue(new Error('network timeout'));
    rpc.getSignatureStatuses.mockResolvedValue({ value: [{ err: null, confirmationStatus: 'confirmed' }] });
    expect((await submitTransaction(options)).deal).toBe(deal);
  });

  it('preserves signature uncertainty after confirmation times out', async () => {
    const { options, rpc, refresh } = setup();
    rpc.confirmTransaction.mockRejectedValue(new Error('network timeout'));
    await expect(submitTransaction(options)).rejects.toMatchObject({ code: 'rpc_error', signature: expect.any(String), outcomeUnknown: true });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('returns a confirmed receipt even if state refresh fails', async () => {
    const { options, refresh } = setup();
    refresh.mockRejectedValue(new Error('Refresh unavailable'));
    await expect(submitTransaction(options)).resolves.toMatchObject({ signature: expect.any(String), deal: null, refreshError: 'Refresh unavailable' });
  });

  it('keeps rejected wallet and failed chain confirmation results', async () => {
    const rejected = setup();
    rejected.sign.mockRejectedValue({ code: 4001, message: 'Rejected' });
    await expect(submitTransaction(rejected.options)).rejects.toMatchObject({ code: 'user_rejected' });
    expect(rejected.rpc.sendRawTransaction).not.toHaveBeenCalled();
    const failed = setup();
    failed.rpc.confirmTransaction.mockResolvedValue({ value: { err: { InstructionError: [2, { Custom: 6002 }] } } });
    await expect(submitTransaction(failed.options)).rejects.toMatchObject({ code: 'transaction_failed', signature: expect.any(String) });
    expect(failed.refresh).not.toHaveBeenCalled();
  });

  it('the actual SDK create client reaches the bridge through its internal import', async () => {
    const { options, rpc, programId } = setup();
    const result = await createBazaarClient({ connection: options.connection, wallet: options.wallet, programId }).createDeal({ creator: Keypair.generate().publicKey.toBase58(), arbiter: Keypair.generate().publicKey.toBase58(), title: 'Synthetic ad', brief: 'Test only', referencesUrl: '', budgetLamports: '1000000', deadlines: [1, 2, 3].map((day) => Math.floor(Date.now() / 1000) + day * 86400) as [number, number, number] });
    const sent = Transaction.from(rpc.sendRawTransaction.mock.calls[0][0]);
    expect(sent.instructions).toHaveLength(3);
    expect(sent.instructions[2].programId.equals(programId)).toBe(true);
    expect(result.signature).toBeTruthy();
    expect(result.deal).toBeNull(); // The mocked RPC intentionally has no created account.
    expect(result.refreshError).toContain('No deal exists');
  });

  it('fits a genuine SDK creation with all text fields at their maximum byte length', async () => {
    const { options, rpc, programId } = setup();
    const prefix = 'https://example.com/';
    await createBazaarClient({ connection: options.connection, wallet: options.wallet, programId }).createDeal({ creator: Keypair.generate().publicKey.toBase58(), arbiter: Keypair.generate().publicKey.toBase58(), title: 'T'.repeat(64), brief: 'B'.repeat(200), referencesUrl: prefix + 'r'.repeat(200 - prefix.length), budgetLamports: '1000000', deadlines: [1, 2, 3].map((day) => Math.floor(Date.now() / 1000) + day * 86400) as [number, number, number] });
    const wire = rpc.sendRawTransaction.mock.calls[0][0];
    const sent = Transaction.from(wire);
    expect(wire.length).toBeLessThanOrEqual(1232);
    expect(sent.instructions).toHaveLength(3);
    expect(sent.instructions[2].programId.equals(programId)).toBe(true);
    expect(sent.verifySignatures()).toBe(true);
  });

  it('preserves genuine IDL instruction bytes and account metas for all seven operations', async () => {
    const ctx = setup();
    const program = new Program(bundledIdl, { connection: ctx.options.connection });
    const payer = ctx.options.wallet.publicKey;
    const creator = Keypair.generate().publicKey;
    const arbiter = Keypair.generate().publicKey;
    const deal = new PublicKey(ctx.options.dealAddress);
    const systemProgram = SystemProgram.programId;
    const builders = [
      program.methods.createDeal(new BN(42), creator, arbiter, 'Ad', 'Brief', '', new BN(1_000_000), [new BN(1), new BN(2), new BN(3)]).accountsStrict({ client: payer, deal, systemProgram }),
      program.methods.acceptDeal().accountsStrict({ creator: payer, deal, systemProgram }),
      program.methods.submitMilestone(0, 'https://example.com/concept.png', Array(32).fill(1), 0).accountsStrict({ creator: payer, deal }),
      program.methods.approveMilestone(0, 1, Array(32).fill(1)).accountsStrict({ client: payer, creator, deal }),
      program.methods.openDispute('Synthetic dispute').accountsStrict({ party: payer, deal }),
      program.methods.resolveDispute({ refund: {} }, 'Synthetic resolution').accountsStrict({ arbiter: payer, client: creator, creator: arbiter, deal }),
      program.methods.cancelUnaccepted().accountsStrict({ client: payer, deal }),
    ];
    for (const builder of builders) {
      const transaction = await builder.transaction();
      const ix = transaction.instructions[0];
      const before = { programId: ix.programId, keys: ix.keys.map((key) => ({ ...key })), data: Buffer.from(ix.data) };
      await submitTransaction({ ...ctx.options, transaction });
      expect(transaction.instructions[2]).toBe(ix);
      expect(ix).toMatchObject(before);
    }
    expect(ctx.rpc.sendRawTransaction).toHaveBeenCalledTimes(7);
  });
});

describe('transport import boundary', () => {
  const plugin = transportBridgePlugin({ sdkEntry: 'C:/project/sdk/src/index.ts', bridge: 'C:/project/web/src/sdkTransportBridge.ts' });
  it('redirects exactly the SDK entry relative transport import on Windows', () => {
    expect(plugin.resolveId('./transport', 'C:\\project\\sdk\\src\\index.ts')).toBe('C:/project/web/src/sdkTransportBridge.ts');
    expect(plugin.resolveId('./transport', 'C:/project/sdk/src/index.ts?test')).toBe('C:/project/web/src/sdkTransportBridge.ts');
  });
  it.each([
    ['./transport', 'C:/project/web/src/sdkTransportBridge.ts'],
    ['./transport', 'C:/other/sdk/src/index.ts'],
    ['../../sdk/src/transport', 'C:/project/web/src/sdkTransportBridge.ts'],
    ['./transport.ts', 'C:/project/sdk/src/index.ts'],
    ['@solana/web3.js', 'C:/project/sdk/src/index.ts'],
    ['./transport', undefined],
  ])('does not redirect %s from %s', (source, importer) => { expect(plugin.resolveId(source!, importer)).toBeNull(); });
});
