import { Connection, Keypair, SystemProgram, Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { describe, expect, it, vi } from 'vitest';
import type { Deal } from '../../shared/api';
import { submitTransaction, type TransactionWallet } from '../src/transport';

function setup() {
  const keypair = Keypair.generate();
  const wallet: TransactionWallet = {
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
  const rpc = {
    getLatestBlockhash: vi.fn().mockResolvedValue({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 12345 }),
    getFeeForMessage: vi.fn().mockResolvedValue({ value: 5000 }),
    getBalance: vi.fn().mockResolvedValue(1000000000),
    simulateTransaction: vi.fn().mockResolvedValue({ value: { err: null, logs: [] } }),
    sendRawTransaction: vi.fn().mockImplementation(async (raw: Uint8Array) => bs58.encode(Transaction.from(raw).signature!)),
    confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
    getSignatureStatuses: vi.fn().mockResolvedValue({ value: [null] }),
  };
  const transaction = new Transaction().add(SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: Keypair.generate().publicKey, lamports: 1 }));
  const deal = { address: Keypair.generate().publicKey.toBase58() } as Deal;
  const refresh = vi.fn().mockResolvedValue(deal);
  const options = { connection: rpc as unknown as Connection, wallet, transaction, dealAddress: deal.address, debitLamports: 1n, refresh };
  return { rpc, options, refresh, deal };
}

describe('real transaction encoding and receipt handling with mockedRPC', () => {
  it('signs an actualSolanatransaction and confirms with its validitywindow', async () => {
    const { rpc, options, deal } = setup();
    const result = await submitTransaction(options);
    expect(result.deal).toBe(deal);
    expect(bs58.decode(result.signature)).toHaveLength(64);
    expect(rpc.confirmTransaction).toHaveBeenCalledWith({ signature: result.signature, ...await rpc.getLatestBlockhash() }, 'confirmed');
    expect(rpc.simulateTransaction.mock.calls[0][1].sigVerify).toBe(false);
  });
  it('returns confirmedreceipt even when subsequentaccount readfails', async () => {
    const { options, refresh } = setup();
    refresh.mockRejectedValue(new Error('RPC unavailable during refresh'));
    const result = await submitTransaction(options);
    expect(result.signature).toBeTruthy();
    expect(result.deal).toBeNull();
    expect(result.refreshError).toContain('RPC unavailable');
  });
  it('never reports success for a rejectedwallet', async () => {
    const { options, rpc } = setup();
    options.wallet.signTransaction = vi.fn().mockRejectedValue({ code: 4001, message: 'Rejected' });
    await expect(submitTransaction(options)).rejects.toMatchObject({ code: 'user_rejected' });
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled();
  });
  it('returns knownsignature when sendingoutcome isuncertain', async () => {
    const { options, rpc, refresh } = setup();
    rpc.sendRawTransaction.mockRejectedValue(new Error('network timeout'));
    await expect(submitTransaction(options)).rejects.toMatchObject({ code: 'rpc_error', signature: expect.any(String), outcomeUnknown: true });
    expect(refresh).not.toHaveBeenCalled();
  });
  it('recovers a confirmedsignature after a lostsendresponse', async () => {
    const { options, rpc } = setup();
    rpc.sendRawTransaction.mockRejectedValue(new Error('network timeout'));
    rpc.getSignatureStatuses.mockResolvedValue({ value: [{ err: null, confirmationStatus: 'confirmed' }] });
    expect((await submitTransaction(options)).deal).not.toBeNull();
  });
  it('returns signature and uncertainty after confirmationtimeout', async () => {
    const { options, rpc } = setup();
    rpc.confirmTransaction.mockRejectedValue(new Error('timeout'));
    await expect(submitTransaction(options)).rejects.toMatchObject({ code: 'rpc_error', signature: expect.any(String), outcomeUnknown: true });
  });
  it('does notpay when simulationfails', async () => {
    const { options, rpc } = setup();
    rpc.simulateTransaction.mockResolvedValue({ value: { err: { InstructionError: [0, { Custom: 6000 }] }, logs: ['Program log: AnchorError. Error Code: WrongRole.'] } });
    await expect(submitTransaction(options)).rejects.toMatchObject({ code: 'wrong_role' });
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled();
  });
  it('rejects insufficientfunds before signing orsimulation', async () => {
    const { options, rpc } = setup();
    rpc.getBalance.mockResolvedValue(5000);
    await expect(submitTransaction(options)).rejects.toMatchObject({ code: 'insufficient_funds' });
    expect(rpc.simulateTransaction).not.toHaveBeenCalled();
  });
  it('reports onchainfailure instead of a confirmedreceipt', async () => {
    const { options, rpc, refresh } = setup();
    rpc.confirmTransaction.mockResolvedValue({ value: { err: { InstructionError: [0, { Custom: 6002 }] } } });
    await expect(submitTransaction(options)).rejects.toMatchObject({ code: 'transaction_failed', signature: expect.any(String) });
    expect(refresh).not.toHaveBeenCalled();
  });
  it('rejects transactions above the wirelimit without wallet interaction', async () => {
    const { options, rpc } = setup();
    options.transaction.instructions[0].data = Buffer.alloc(1300);
    await expect(submitTransaction(options)).rejects.toMatchObject({ code: 'invalid_input' });
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled();
  });
  it('rejects wallets that alter the agreedtransaction', async () => {
    const { options, rpc } = setup();
    const original = options.wallet.signTransaction.bind(options.wallet);
    options.wallet.signTransaction = async (transaction) => {
      if (transaction instanceof Transaction) transaction.instructions[0].data[0] = 99;
      return original(transaction);
    };
    await expect(submitTransaction(options)).rejects.toMatchObject({ code: 'transaction_failed' });
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled();
  });
});
