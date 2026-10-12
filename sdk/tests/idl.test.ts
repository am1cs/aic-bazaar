import { BorshInstructionCoder, Program } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';
import { bundledIdl } from '../src/idl';
import { deriveDealAddress } from '../src';

// Genuine compiler-generated IDL is used here. No RPC or on-chain execution.
const connection = new Connection('http://127.0.0.1:8899');
const program = new Program(bundledIdl, { connection });
const client = Keypair.generate().publicKey;
const creator = Keypair.generate().publicKey;
const arbiter = Keypair.generate().publicKey;
const deal = deriveDealAddress(program.programId, client, 42n);

async function wire(name: string, args: unknown[], accounts: Record<string, PublicKey>): Promise<number> {
  const instruction = await program.methods[name](...args).accountsStrict(accounts).instruction();
  const decoded = new BorshInstructionCoder(program.idl).decode(instruction.data);
  expect(decoded?.name).toBe(name);
  const transaction = new Transaction({ feePayer: accounts.client ?? accounts.creator ?? accounts.arbiter ?? accounts.party, recentBlockhash: Keypair.generate().publicKey.toBase58() }).add(instruction);
  return transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
}

describe('generated IDL compatibility and maximum wire fields', () => {
  it('encodes maximum creation terms below the network wire limit', async () => {
    const length = await wire('createDeal', [new BN(42), creator, arbiter, 'a'.repeat(64), 'b'.repeat(200), `https://example.com/${'r'.repeat(180)}`, new BN('1000000000'), [new BN(2000000001), new BN(2000000002), new BN(2000000003)]], { client, deal, systemProgram: SystemProgram.programId });
    expect(length).toBeLessThanOrEqual(1232);
    expect(length).toBeGreaterThan(800);
  });
  it('encodes all seven agreed instructions from the actual IDL', async () => {
    const examples: [string, unknown[], Record<string, PublicKey>][] = [
      ['acceptDeal', [], { creator, deal, systemProgram: SystemProgram.programId }],
      ['submitMilestone', [2, `https://example.com/${'s'.repeat(180)}`, Array(32).fill(255), 1], { creator, deal }],
      ['approveMilestone', [2, 2, Array(32).fill(255)], { client, creator, deal }],
      ['openDispute', ['d'.repeat(200)], { party: client, deal }],
      ['resolveDispute', [{ creatorBreach: {} }, 'r'.repeat(200)], { arbiter, client, creator, deal }],
      ['cancelUnaccepted', [], { client, deal }],
    ];
    for (const [name, args, accounts] of examples) expect(await wire(name, args, accounts)).toBeLessThanOrEqual(1232);
  });
  it('derives distinct immutable PDA addresses for different deal IDs', () => {
    expect(deal.equals(deriveDealAddress(program.programId, client, 42n))).toBe(true);
    expect(deal.equals(deriveDealAddress(program.programId, client, 43n))).toBe(false);
    expect(() => deriveDealAddress(program.programId, client, -1n)).toThrow();
    expect(() => deriveDealAddress(program.programId, client, 18446744073709551616n)).toThrow();
  });
});
