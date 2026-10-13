import { describe, expect, it, vi } from 'vitest';
import { ComputeBudgetInstruction, Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { createBazaarClient, type TransactionWallet } from '@aic-bazaar/sdk';
import manifest from '../../deployment/devnet.json';

// Public address only. No private key, signing or transaction submission is used.
const customer = new PublicKey('J5YwFGz6KRQBcEVUyeTREaPWBn8pkNzdQ4mXHY88A7ue');

describe('Live Devnet Phantom preparation without signing', () => {
  it('simulates a real SDK create with explicit fees and stops at the signing boundary', async () => {
    const connection = new Connection(manifest.rpcUrl, 'confirmed');
    const send = vi.spyOn(connection, 'sendRawTransaction').mockRejectedValue(new Error('This read-only check must never send.'));
    let prepared: Transaction | null = null;
    const wallet: TransactionWallet = {
      publicKey: customer,
      async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
        if (transaction instanceof Transaction) prepared = transaction;
        throw new Error('Read-only preflight: signing intentionally stopped.');
      },
      async signAllTransactions<T extends Transaction | VersionedTransaction>(): Promise<T[]> {
        throw new Error('Read-only preflight: signing intentionally stopped.');
      },
    };
    const client = createBazaarClient({ connection, wallet, programId: manifest.programId });
    const now = Math.floor(Date.now() / 1000);
    await expect(client.createDeal({
      creator: '48sEAFKWoLqucJbiqSq1QZ1zs5hTr9ZMjkXJnwLbwsy8',
      arbiter: 'DPrNTxjQ7eEiHFp8uszufwEc9jUhZxJ51ZN8JisqrVqR',
      title: 'Unsigned Phantom compatibility preflight',
      brief: 'Synthetic Devnet simulation only. No signature or funds transfer.',
      referencesUrl: '', budgetLamports: '1000000',
      deadlines: [now + 3600, now + 7200, now + 10800],
    })).rejects.toMatchObject({ message: 'Read-only preflight: signing intentionally stopped.' });
    expect(prepared).not.toBeNull();
    const transaction = prepared! as Transaction;
    expect(transaction.instructions).toHaveLength(3);
    expect(ComputeBudgetInstruction.decodeSetComputeUnitLimit(transaction.instructions[0]).units).toBe(200_000);
    expect(ComputeBudgetInstruction.decodeSetComputeUnitPrice(transaction.instructions[1]).microLamports).toBe(0n);
    expect(transaction.instructions[2].programId.toBase58()).toBe(manifest.programId);
    expect(transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).length).toBeLessThanOrEqual(1232);
    expect(send).not.toHaveBeenCalled();
  });
});
