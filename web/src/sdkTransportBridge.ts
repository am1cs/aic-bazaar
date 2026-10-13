import { ComputeBudgetProgram, PublicKey } from '@solana/web3.js';
import deployment from '../../deployment/devnet.json';
import { BazaarSdkError } from '../../sdk/src/errors';
import { submitTransaction as submitWithSdk, type SubmitOptions } from '../../sdk/src/transport';

export type { TransactionWallet } from '../../sdk/src/transport';

const programId = new PublicKey(deployment.programId);

/** Prepare the SDK's unsigned transaction before its simulation and message snapshot. */
export async function submitTransaction(options: SubmitOptions) {
  const { transaction } = options;
  // The current SDK builds exactly one Bazaar instruction for every operation.
  // Reject a changed transaction layout instead of adding duplicate fee instructions.
  if (deployment.status !== 'deployed' || deployment.cluster !== 'devnet'
    || transaction.instructions.length !== 1
    || !transaction.instructions[0].programId.equals(programId)
    || transaction.signatures.some(({ signature }) => signature !== null)) {
    throw new BazaarSdkError('invalid_input', 'The SDK transaction layout changed. Nothing was submitted.');
  }

  // Phantom preserves transactions that already specify their compute budget.
  // Match the existing single-program 200k limit and default zero priority fee.
  transaction.instructions.unshift(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 0 }),
  );
  // Keep the genuine SDK's size, funds, simulation, signature, exact-message,
  // submission, confirmation and recovery checks without removing any instruction.
  return submitWithSdk(options);
}
