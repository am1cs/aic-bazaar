import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import type { MutationResult } from '../../shared/api';
import { BazaarSdkError, normalizeError } from './errors';

export interface TransactionWallet {
  publicKey: import('@solana/web3.js').PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
}

export interface SubmitOptions {
  connection: Connection;
  wallet: TransactionWallet;
  transaction: Transaction;
  dealAddress: string;
  debitLamports: bigint;
  refresh: () => Promise<import('../../shared/api').Deal>;
}

/** A signed transaction may land even if the RPC times out returning its receipt. */
async function recoverConfirmed(connection: Connection, signature: string): Promise<boolean> {
  try {
    const result = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
    const status = result.value[0];
    if (status?.err) throw new BazaarSdkError('transaction_failed', 'The transaction failed on-chain.', { signature });
    return !!status && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized');
  } catch (error) {
    if (error instanceof BazaarSdkError) throw error;
    return false;
  }
}

export async function submitTransaction(options: SubmitOptions): Promise<MutationResult> {
  const { connection, wallet, transaction, dealAddress, debitLamports, refresh } = options;
  const blockhash = await connection.getLatestBlockhash('confirmed');
  transaction.feePayer = wallet.publicKey;
  transaction.recentBlockhash = blockhash.blockhash;
  transaction.lastValidBlockHeight = blockhash.lastValidBlockHeight;

  // Check the complete wire format before asking the user to sign anything.
  let unsignedWire: Uint8Array;
  try { unsignedWire = transaction.serialize({ requireAllSignatures: false, verifySignatures: false }); }
  catch (error) { throw new BazaarSdkError('invalid_input', 'The transaction is too large or could not be encoded.', { cause: error }); }
  if (unsignedWire.length > 1232) throw new BazaarSdkError('invalid_input', 'The transaction exceeds Solana’s 1232-byte limit. Shorten the text or URLs.');

  const [fee, balance] = await Promise.all([
    connection.getFeeForMessage(transaction.compileMessage(), 'confirmed'),
    connection.getBalance(wallet.publicKey, 'confirmed'),
  ]);
  if (fee.value === null) throw new BazaarSdkError('rpc_error', 'The RPC could not estimate the transaction fee.');
  if (BigInt(balance) < debitLamports + BigInt(fee.value)) throw new BazaarSdkError('insufficient_funds', 'Insufficient test SOL for escrow, account rent, and transaction fees.');

  const simulation = await connection.simulateTransaction(new VersionedTransaction(transaction.compileMessage()), { sigVerify: false, commitment: 'confirmed' });
  if (simulation.value.err) throw normalizeError({ message: `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`, logs: simulation.value.logs }, 'transaction_failed');

  const expectedMessage = transaction.serializeMessage();
  let signed: Transaction;
  try { signed = await wallet.signTransaction(transaction); }
  catch (error) { throw normalizeError(error, 'user_rejected'); }
  if (!signed.serializeMessage().equals(expectedMessage)) throw new BazaarSdkError('transaction_failed', 'The wallet changed the transaction message. Nothing was submitted.');
  if (!signed.signature) throw new BazaarSdkError('user_rejected', 'The wallet returned an unsigned transaction.');
  let signedWire: Uint8Array;
  try { signedWire = signed.serialize(); }
  catch (error) { throw new BazaarSdkError('transaction_failed', 'The wallet signature could not be verified. Nothing was submitted.', { cause: error }); }
  // The signature is known before sending, so a lost RPC response cannot erase it.
  let signature = bs58.encode(signed.signature);
  try {
    const returned = await connection.sendRawTransaction(signedWire, { skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 3 });
    if (returned !== signature) throw new BazaarSdkError('rpc_error', 'The RPC returned a different transaction signature.', { signature, outcomeUnknown: true });
    signature = returned;
  } catch (error) {
    const normalized = normalizeError(error);
    if (normalized.code !== 'rpc_error' || (error as { logs?: unknown })?.logs) {
      normalized.signature = signature;
      throw normalized;
    }
    if (!(await recoverConfirmed(connection, signature))) throw new BazaarSdkError('rpc_error', 'The submission result is unknown. Check this signature before retrying.', { cause: error, signature, outcomeUnknown: true });
  }

  try {
    const confirmation = await connection.confirmTransaction({ signature, ...blockhash }, 'confirmed');
    if (confirmation.value.err) throw new BazaarSdkError('transaction_failed', 'The transaction failed on-chain.', { signature });
  } catch (error) {
    if (error instanceof BazaarSdkError && error.code === 'transaction_failed') throw error;
    if (!(await recoverConfirmed(connection, signature))) throw new BazaarSdkError('rpc_error', 'Confirmation is uncertain. Check this signature before retrying.', { signature, outcomeUnknown: true, cause: error });
  }
  try { return { signature, dealAddress, deal: await refresh() }; }
  catch (error) { return { signature, dealAddress, deal: null, refreshError: normalizeError(error).message }; }
}
