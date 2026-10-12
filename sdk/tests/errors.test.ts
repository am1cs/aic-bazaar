import { describe, expect, it } from 'vitest';
import { BazaarSdkError, normalizeError } from '../src/errors';

describe('normalized actionable errors', () => {
  it('recognizes wallet rejection and Anchor structured errors', () => {
    expect(normalizeError({ code: 4001, message: 'Request rejected' }).code).toBe('user_rejected');
    expect(normalizeError({ error: { errorCode: { code: 'StaleSubmission' }, errorMessage: 'Review changed material' } }).code).toBe('stale_submission');
  });
  it('recognizes program errors in simulation logs', () => {
    expect(normalizeError({ message: 'simulation failed', logs: ['Program log: AnchorError. Error Code: WrongRole. Error Number:6000.'] }).code).toBe('wrong_role');
    expect(normalizeError({ message: 'simulation failed', logs: ['Program log: AnchorError. Error Code: RevisionLimit.'] }).code).toBe('revision_limit');
  });
  it('preserves confirmed-signature uncertaintydetails', () => {
    const error = new BazaarSdkError('rpc_error', 'Check signature', { signature: 'test', outcomeUnknown: true });
    expect(normalizeError(error)).toBe(error);
    expect(error.outcomeUnknown).toBe(true);
  });
  it('identifies insufficientfunds and missingprograms', () => {
    expect(normalizeError(new Error('insufficient lamports')).code).toBe('insufficient_funds');
    expect(normalizeError(new Error('Attempt to load a program that does not exist')).code).toBe('not_deployed');
  });
});
