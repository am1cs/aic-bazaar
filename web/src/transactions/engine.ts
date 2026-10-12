import type { BazaarErrorCode, MutationResult } from '../../../shared/api';

/** Public transaction metadata only. Never store account balances or signed transactions. */
export interface Attempt {
  readonly id: string;
  readonly action: string;
  readonly wallet: string;
  readonly dealAddress?: string;
  readonly signature?: string;
  readonly startedAt: number;
  readonly state: 'pending' | 'confirmed' | 'failed' | 'unknown';
  readonly refreshError?: string;
}

export interface OperationContext {
  action: string;
  wallet: string;
  dealAddress?: string;
}

export interface OperationError {
  readonly code?: BazaarErrorCode;
  readonly message: string;
  readonly signature?: string;
  readonly outcomeUnknown: boolean;
}

export interface OperationSnapshot {
  readonly attempt: Attempt | null;
  readonly busy: boolean;
  readonly error: OperationError | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SignatureStatusConnection {
  getSignatureStatuses(
    signatures: string[],
    options: { searchTransactionHistory: boolean },
  ): Promise<{
    value: ({ err: unknown; confirmationStatus?: 'processed' | 'confirmed' | 'finalized' | null } | null)[];
  }>;
}

export const ATTEMPT_STORAGE_KEY = 'aic-bazaar.operation.v1';

const errorCodes = new Set<BazaarErrorCode>([
  'wallet_required', 'wrong_role', 'invalid_input', 'invalid_state',
  'stale_submission', 'revision_limit', 'insufficient_funds', 'user_rejected',
  'rpc_error', 'transaction_failed', 'not_found', 'not_deployed',
]);

const recoveryMessage = 'An earlier operation has an unknown result. Check its signature before starting another operation.';
let sequence = 0;

function makeId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  sequence += 1;
  return `${Date.now()}-${sequence}-${Math.random().toString(36).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function publicString(value: unknown, maxLength = 256): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function isBazaarError(error: unknown): boolean {
  return isRecord(error) && typeof error.code === 'string' && errorCodes.has(error.code as BazaarErrorCode);
}

function normalizeError(error: unknown): OperationError {
  const record = isRecord(error) ? error : {};
  const known = isBazaarError(error);
  return Object.freeze({
    ...(known ? { code: record.code as BazaarErrorCode } : {}),
    message: known && typeof record.message === 'string' && record.message.trim()
      ? record.message
      : 'The operation ended unexpectedly. Its result is unknown; check your wallet activity before trying again.',
    ...(publicString(record.signature, 160) ? { signature: record.signature } : {}),
    // An unexpected exception may have happened after submission. It is never proof of failure.
    outcomeUnknown: record.outcomeUnknown === true || !known,
  });
}

function readAttempt(raw: string): Attempt {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)
    || !publicString(value.id)
    || !publicString(value.action, 120)
    || !publicString(value.wallet, 128)
    || !Number.isSafeInteger(value.startedAt)
    || (value.startedAt as number) < 0
    || !['pending', 'confirmed', 'failed', 'unknown'].includes(value.state as string)
    || (value.dealAddress !== undefined && !publicString(value.dealAddress, 128))
    || (value.signature !== undefined && !publicString(value.signature, 160))
    || (value.refreshError !== undefined && typeof value.refreshError !== 'string')) {
    throw new Error('Invalid operation journal.');
  }
  // Deliberately select fields instead of accepting arbitrary persisted data.
  return Object.freeze({
    id: value.id,
    action: value.action,
    wallet: value.wallet,
    startedAt: value.startedAt as number,
    state: value.state === 'pending' ? 'unknown' : value.state as Attempt['state'],
    ...(value.dealAddress !== undefined ? { dealAddress: value.dealAddress as string } : {}),
    ...(value.signature !== undefined ? { signature: value.signature as string } : {}),
    ...(value.refreshError !== undefined ? { refreshError: value.refreshError as string } : {}),
  });
}

function browserStorage(): StorageLike | undefined {
  if (typeof window === 'undefined') return undefined;
  // Access can throw when storage is disabled. The constructor handles that conservatively.
  return window.sessionStorage;
}

/**
 * The application shares one controller across every route and operation button.
 * The lock is acquired before the SDK callback or the first await, so a double
 * click cannot open two wallet requests. No mutation is ever retried here.
 */
export class OperationController {
  private storage: StorageLike | undefined;
  private snapshot: OperationSnapshot = Object.freeze({ attempt: null, busy: false, error: null });
  private listeners = new Set<() => void>();

  constructor(storage?: StorageLike) {
    try {
      this.storage = storage ?? browserStorage();
      const raw = this.storage?.getItem(ATTEMPT_STORAGE_KEY);
      if (raw !== null && raw !== undefined) {
        const attempt = readAttempt(raw);
        this.snapshot = Object.freeze({
          attempt,
          busy: false,
          error: attempt.state === 'unknown'
            ? Object.freeze({ message: recoveryMessage, signature: attempt.signature, outcomeUnknown: true })
            : null,
        });
        // Save the pending -> unknown transition. Failure cannot erase the receipt we read.
        if (JSON.parse(raw).state === 'pending') {
          try { this.persist(attempt); } catch { /* The in-memory recovery lock remains active. */ }
        }
      }
    } catch {
      // Corrupt or inaccessible storage must not silently authorize a second debit.
      this.snapshot = Object.freeze({
        attempt: Object.freeze({ id: makeId(), action: 'Recovery required', wallet: 'Unavailable', startedAt: Date.now(), state: 'unknown' }),
        busy: false,
        error: Object.freeze({ message: 'The saved operation could not be read. Check your wallet activity before starting another operation.', outcomeUnknown: true }),
      });
    }
  }

  /** This object remains identical until a real controller update, for useSyncExternalStore. */
  getSnapshot = (): OperationSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(attempt: Attempt | null, busy: boolean, error: OperationError | null): void {
    this.snapshot = Object.freeze({
      attempt: attempt ? Object.freeze({ ...attempt }) : null,
      busy,
      error: error ? Object.freeze({ ...error }) : null,
    });
    // One broken subscriber must not interrupt receipt persistence or release the lock early.
    for (const listener of this.listeners) {
      try { listener(); } catch { /* React subscribes only a state notification. */ }
    }
  }

  private persist(attempt: Attempt): void {
    this.storage?.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(attempt));
  }

  private finish(attempt: Attempt, error: OperationError | null): void {
    try { this.persist(attempt); }
    catch {
      const message = attempt.state === 'confirmed'
        ? 'The transaction is confirmed, but your browser could not save its receipt. Keep the signature before leaving this page.'
        : 'Your browser could not save this operation result. Keep any signature before leaving this page.';
      error = {
        ...error,
        message: error ? `${error.message} ${message}` : message,
        signature: attempt.signature,
        outcomeUnknown: attempt.state === 'unknown',
      };
    }
    this.publish(attempt, false, error);
  }

  run = async (
    context: OperationContext,
    operation: () => Promise<MutationResult>,
  ): Promise<MutationResult | null> => {
    if (this.snapshot.busy || this.snapshot.attempt?.state === 'unknown' || this.snapshot.attempt?.state === 'pending') return null;
    if (!publicString(context.action, 120) || !publicString(context.wallet, 128)
      || (context.dealAddress !== undefined && !publicString(context.dealAddress, 128))) {
      this.publish(this.snapshot.attempt, false, { code: 'invalid_input', message: 'An operation requires its action, originating wallet, and a valid deal context.', outcomeUnknown: false });
      return null;
    }

    // Copy the originating account and route; later wallet changes cannot retag the receipt.
    const attempt: Attempt = Object.freeze({
      id: makeId(), action: context.action, wallet: context.wallet,
      ...(context.dealAddress !== undefined ? { dealAddress: context.dealAddress } : {}),
      startedAt: Date.now(), state: 'pending',
    });
    // Lock even before calling the storage adapter; it may throw or be re-entrant.
    this.snapshot = Object.freeze({ attempt, busy: true, error: null });
    try { this.persist(attempt); }
    catch {
      this.publish({ ...attempt, state: 'failed' }, false, {
        message: 'Your browser could not save the operation journal. Nothing was submitted. Enable session storage before trying again.',
        outcomeUnknown: false,
      });
      return null;
    }
    this.publish(attempt, true, null);

    try {
      const result = await operation();
      if (!result || !publicString(result.signature, 160) || !publicString(result.dealAddress, 128)
        || (attempt.dealAddress !== undefined && result.dealAddress !== attempt.dealAddress)
        || (result.deal !== null && result.deal?.address !== result.dealAddress)) {
        const error = Object.assign(new Error('The SDK returned a receipt for a different operation. Check the signature before retrying.'), {
          ...(result && publicString(result.signature, 160) ? { signature: result.signature } : {}),
          outcomeUnknown: true,
        });
        throw error;
      }
      this.finish({
        ...attempt, signature: result.signature, dealAddress: result.dealAddress, state: 'confirmed',
        ...(typeof result.refreshError === 'string' ? { refreshError: result.refreshError } : {}),
      }, null);
      return result;
    } catch (error) {
      const normalized = normalizeError(error);
      this.finish({
        ...attempt,
        state: normalized.outcomeUnknown ? 'unknown' : 'failed',
        ...(normalized.signature ? { signature: normalized.signature } : {}),
      }, normalized);
      if (!isBazaarError(error)) throw error;
      return null;
    }
  };

  check = async (connection: SignatureStatusConnection): Promise<void> => {
    const attempt = this.snapshot.attempt;
    if (this.snapshot.busy || !attempt || attempt.state !== 'unknown') return;
    if (!attempt.signature) {
      this.publish(attempt, false, {
        message: 'No signature was returned before the operation was interrupted. Check the originating wallet and Explorer manually; its result remains unknown.',
        outcomeUnknown: true,
      });
      return;
    }
    this.publish(attempt, true, this.snapshot.error);
    try {
      const response = await connection.getSignatureStatuses([attempt.signature], { searchTransactionHistory: true });
      const status = response.value[0];
      if (status && status.err !== null && status.err !== undefined) {
        this.finish({ ...attempt, state: 'failed' }, {
          code: 'transaction_failed', message: 'The transaction failed on-chain. Refresh the deal before reviewing another action.',
          signature: attempt.signature, outcomeUnknown: false,
        });
      } else if (status && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')) {
        // The parent refreshes with BazaarClient.getDeal; signature status does not supply a deal.
        this.finish({ ...attempt, state: 'confirmed' }, null);
      } else {
        this.finish(attempt, {
          code: 'rpc_error',
          message: status?.confirmationStatus === 'processed'
            ? 'The transaction is still being processed. Check again before starting another operation.'
            : 'The RPC has no confirmed result for this signature. Its absence does not prove failure; check again before starting another operation.',
          signature: attempt.signature, outcomeUnknown: true,
        });
      }
    } catch {
      this.finish(attempt, {
        code: 'rpc_error', message: 'The RPC status check failed. The transaction result remains unknown; check again before starting another operation.',
        signature: attempt.signature, outcomeUnknown: true,
      });
    }
  };

  clearResolved = (): void => {
    const attempt = this.snapshot.attempt;
    if (this.snapshot.busy || !attempt || (attempt.state !== 'confirmed' && attempt.state !== 'failed')) return;
    try { this.storage?.removeItem(ATTEMPT_STORAGE_KEY); }
    catch {
      this.publish(attempt, false, { message: 'Your browser could not clear the saved receipt. Keep its signature before leaving this page.', signature: attempt.signature, outcomeUnknown: false });
      return;
    }
    this.publish(null, false, null);
  };
}
