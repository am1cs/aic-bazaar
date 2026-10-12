import type { BazaarErrorCode } from '../../shared/api';

export class BazaarSdkError extends Error {
  readonly code: BazaarErrorCode;
  signature?: string;
  outcomeUnknown?: boolean;

  constructor(code: BazaarErrorCode, message: string, details: { signature?: string; outcomeUnknown?: boolean; cause?: unknown } = {}) {
    super(message, { cause: details.cause });
    this.name = 'BazaarSdkError';
    this.code = code;
    this.signature = details.signature;
    this.outcomeUnknown = details.outcomeUnknown;
  }
}

const PROGRAM_ERRORS: Record<string, BazaarErrorCode> = {
  Unauthorized: 'wrong_role', WrongRole: 'wrong_role', InvalidRole: 'wrong_role',
  InvalidState: 'invalid_state', WrongState: 'invalid_state',
  StaleSubmission: 'stale_submission', StaleRevision: 'stale_submission', HashMismatch: 'stale_submission',
  RevisionLimit: 'revision_limit', RevisionLimitReached: 'revision_limit',
  InsufficientFunds: 'insufficient_funds', InsufficientEscrow: 'insufficient_funds',
  InvalidInput: 'invalid_input', InvalidAmount: 'invalid_input', InvalidBudget: 'invalid_input',
  InvalidDeadlines: 'invalid_input', InvalidUrl: 'invalid_input', InvalidParticipants: 'invalid_input',
};

export function normalizeError(error: unknown, fallback: BazaarErrorCode = 'rpc_error'): BazaarSdkError {
  if (error instanceof BazaarSdkError) return error;
  const value = error as { code?: number | string; message?: string; logs?: string[]; error?: { errorCode?: { code?: string }; errorMessage?: string } } | null;
  const message = value?.message || (typeof error === 'string' ? error : 'The operation failed. Please retry after checking the network.');
  const logs = Array.isArray(value?.logs) ? value!.logs!.join('\n') : '';
  const all = `${message}\n${logs}`;
  if (value?.code === 4001 || /user rejected|user denied|declined|rejected the request|rejected.*transaction/i.test(message)) {
    return new BazaarSdkError('user_rejected', 'The wallet request was rejected.', { cause: error });
  }
  const named = value?.error?.errorCode?.code || /Error Code: (\w+)/.exec(all)?.[1];
  if (named && PROGRAM_ERRORS[named]) return new BazaarSdkError(PROGRAM_ERRORS[named], value?.error?.errorMessage || message, { cause: error });
  if (/insufficient (?:funds|lamports)|insufficientfunds|attempt to debit.*no prior credit/i.test(all)) {
    return new BazaarSdkError('insufficient_funds', 'Insufficient test SOL for escrow, account rent, or transaction fees.', { cause: error });
  }
  if (/AccountNotInitialized|account does not exist|could not find account/i.test(all)) return new BazaarSdkError('not_found', 'The deal account was not found.', { cause: error });
  if (/Attempt to load a program that does not exist|ProgramAccountNotFound|program is not deployed/i.test(all)) return new BazaarSdkError('not_deployed', 'The configured program is not deployed on this network.', { cause: error });
  return new BazaarSdkError(fallback, message, { cause: error });
}
