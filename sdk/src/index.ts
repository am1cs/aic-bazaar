import './polyfills';
import { Program } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { Buffer } from 'buffer';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import type { BazaarClient, CreateDealInput, Deal, MutationResult, Resolution } from '../../shared/api';
import { normalizeDeal, type RawDeal } from './account';
import { BazaarSdkError, normalizeError } from './errors';
import { bundledIdl } from './idl';
import { submitTransaction, type TransactionWallet } from './transport';
import { hash, httpsUrl, milestoneIndex, publicKey, resolution, text, validateCreate } from './validation';

export type { Address, BazaarClient, BazaarError, BazaarErrorCode, CreateDealInput, Deal, DealStatus, Lamports, Milestone, MilestoneIndex, MutationResult, Resolution, Sha256 } from '../../shared/api';
export type { TransactionWallet } from './transport';
export { BazaarSdkError } from './errors';
export { amounts as calculateAmounts } from './validation';

export const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const MAINNET_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const DEAL_ACCOUNT_SPACE = 1904;

export interface BazaarClientOptions {
  connection: Connection;
  wallet: TransactionWallet | null;
  programId: PublicKey | string;
  /** Test-only: permit a non-mainnet local validator at a loopback HTTP URL. */
  allowLocalValidator?: boolean;
}

function loopback(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (url.protocol === 'http:' || url.protocol === 'https:') && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

export function deriveDealAddress(programId: PublicKey, client: PublicKey, dealId: bigint): PublicKey {
  if (dealId < 0n || dealId > 18_446_744_073_709_551_615n) throw new BazaarSdkError('invalid_input', 'Deal ID is outside the u64 range.');
  const seed = new BN(dealId.toString()).toArrayLike(Buffer, 'le', 8);
  return PublicKey.findProgramAddressSync([Buffer.from('deal'), client.toBuffer(), seed], programId)[0];
}

function randomDealId(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return bytes.reduceRight((value, byte) => value * 256n + BigInt(byte), 0n);
}

class Client implements BazaarClient {
  private readonly programId: PublicKey;
  private program: Program | null = null;
  private readiness: Promise<void> | null = null;

  constructor(private readonly options: BazaarClientOptions) {
    if (!options.programId) throw new BazaarSdkError('not_deployed', 'A deployed AIC Bazaar program address is required.');
    this.programId = publicKey(options.programId, 'Program ID');
    if (this.programId.equals(SystemProgram.programId)) throw new BazaarSdkError('not_deployed', 'The system program cannot be used as an AIC Bazaar deployment.');
  }

  private wallet(): TransactionWallet {
    if (!this.options.wallet?.publicKey || typeof this.options.wallet.signTransaction !== 'function' || typeof this.options.wallet.signAllTransactions !== 'function') throw new BazaarSdkError('wallet_required', 'Connect a Solana wallet that supports signing transactions to continue.');
    return this.options.wallet;
  }

  private async ready(): Promise<Program> {
    if (!bundledIdl) throw new BazaarSdkError('not_deployed', 'The real generated AIC Bazaar IDL is not available yet.');
    if (bundledIdl.address !== this.programId.toBase58()) throw new BazaarSdkError('not_deployed', 'The program address does not match the bundled generated IDL.');
    if (!this.readiness) {
      this.readiness = (async () => {
        const genesis = await this.options.connection.getGenesisHash();
        const local = this.options.allowLocalValidator === true && loopback(this.options.connection.rpcEndpoint) && genesis !== MAINNET_GENESIS_HASH;
        if (genesis !== DEVNET_GENESIS_HASH && !local) throw new BazaarSdkError('invalid_input', 'AIC Bazaar uses Solana Devnet only. Choose a Devnet RPC endpoint.');
        const account = await this.options.connection.getAccountInfo(this.programId, 'confirmed');
        if (!account?.executable) throw new BazaarSdkError('not_deployed', 'The configured AIC Bazaar program is not deployed on this network.');
        this.program = new Program(bundledIdl, { connection: this.options.connection });
      })().catch((error) => { this.readiness = null; throw normalizeError(error); });
    }
    await this.readiness;
    return this.program!;
  }

  private async raw(address: string): Promise<{ publicKey: PublicKey; raw: RawDeal; deal: Deal }> {
    const key = publicKey(address, 'Deal address');
    const program = await this.ready();
    const account = await this.options.connection.getAccountInfo(key, 'confirmed');
    if (!account) throw new BazaarSdkError('not_found', 'No deal exists at this address.');
    if (!account.owner.equals(this.programId)) throw new BazaarSdkError('not_found', 'This account is not an AIC Bazaar deal.');
    let raw: RawDeal;
    try { raw = program.coder.accounts.decode('deal', account.data) as RawDeal; }
    catch (error) { throw new BazaarSdkError('not_found', 'This account is not a valid AIC Bazaar deal.', { cause: error }); }
    if (!deriveDealAddress(this.programId, raw.client, BigInt(raw.dealId.toString())).equals(key)) throw new BazaarSdkError('not_found', 'This account does not match its deal address.');
    return { publicKey: key, raw, deal: normalizeDeal(key, raw) };
  }

  private role(deal: Deal, permitted: string[]) {
    const address = this.wallet().publicKey.toBase58();
    if (!permitted.includes(address)) throw new BazaarSdkError('wrong_role', 'Your connected wallet does not have permission for this action.');
  }

  private state(deal: Deal, expected: Deal['status']) {
    if (deal.status !== expected) throw new BazaarSdkError('invalid_state', `This action requires an ${expected.replaceAll('_', ' ')} deal.`);
  }

  private async mutate(address: PublicKey, name: string, args: unknown[], accounts: Record<string, PublicKey>, debitLamports = 0n): Promise<MutationResult> {
    const wallet = this.wallet();
    const program = await this.ready();
    const builder = program.methods[name](...args).accountsStrict(accounts);
    const transaction: Transaction = await builder.transaction();
    return submitTransaction({ connection: this.options.connection, wallet, transaction, dealAddress: address.toBase58(), debitLamports, refresh: () => this.getDeal(address.toBase58()) });
  }

  private async guarded<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) { throw normalizeError(error); }
  }

  getDeal(address: string): Promise<Deal> {
    return this.guarded(async () => (await this.raw(address)).deal);
  }

  createDeal(input: CreateDealInput): Promise<MutationResult> {
    return this.guarded(async () => {
      const wallet = this.wallet();
      const { creator, arbiter } = validateCreate(input, wallet.publicKey);
      await this.ready();
      const id = randomDealId();
      const address = deriveDealAddress(this.programId, wallet.publicKey, id);
      const rent = await this.options.connection.getMinimumBalanceForRentExemption(DEAL_ACCOUNT_SPACE, 'confirmed');
      return this.mutate(address, 'createDeal', [new BN(id.toString()), creator, arbiter, input.title, input.brief, input.referencesUrl, new BN(input.budgetLamports), input.deadlines.map((deadline) => new BN(deadline))], { client: wallet.publicKey, deal: address, systemProgram: SystemProgram.programId }, BigInt(input.budgetLamports) + BigInt(rent));
    });
  }

  acceptDeal(address: string): Promise<MutationResult> {
    return this.guarded(async () => {
      this.wallet();
      const result = await this.raw(address);
      this.role(result.deal, [result.deal.creator]);
      this.state(result.deal, 'awaiting_creator');
      return this.mutate(result.publicKey, 'acceptDeal', [], { creator: this.wallet().publicKey, deal: result.publicKey, systemProgram: SystemProgram.programId }, BigInt(result.deal.bondLamports));
    });
  }

  submitMilestone(input: Parameters<BazaarClient['submitMilestone']>[0]): Promise<MutationResult> {
    return this.guarded(async () => {
      this.wallet();
      const index = milestoneIndex(input.index);
      httpsUrl(input.url, 'Submission URL');
      const sha256 = hash(input.sha256);
      if (input.expectedRevision !== 0 && input.expectedRevision !== 1) throw new BazaarSdkError('invalid_input', 'Expected prior submission revision must be 0 or 1.');
      const result = await this.raw(input.address);
      this.role(result.deal, [result.deal.creator]);
      this.state(result.deal, 'active');
      if (result.deal.currentMilestone !== index) throw new BazaarSdkError('stale_submission', 'The current milestone changed. Refresh the deal.');
      const revision = result.deal.milestones[index].submission?.revision ?? 0;
      if (revision >= 2) throw new BazaarSdkError('revision_limit', 'This milestone already used its one replacement.');
      if (revision !== input.expectedRevision) throw new BazaarSdkError('stale_submission', 'The submission changed. Refresh before uploading another revision.');
      return this.mutate(result.publicKey, 'submitMilestone', [index, input.url, sha256, input.expectedRevision], { creator: this.wallet().publicKey, deal: result.publicKey });
    });
  }

  approveMilestone(input: Parameters<BazaarClient['approveMilestone']>[0]): Promise<MutationResult> {
    return this.guarded(async () => {
      this.wallet();
      const index = milestoneIndex(input.index);
      const expectedHash = hash(input.expectedHash);
      if (input.expectedRevision !== 1 && input.expectedRevision !== 2) throw new BazaarSdkError('invalid_input', 'Expected submission revision must be 1 or 2.');
      const result = await this.raw(input.address);
      this.role(result.deal, [result.deal.client]);
      this.state(result.deal, 'active');
      const submission = result.deal.milestones[index].submission;
      if (result.deal.currentMilestone !== index || !submission || submission.revision !== input.expectedRevision || submission.sha256 !== input.expectedHash) throw new BazaarSdkError('stale_submission', 'The milestone or material changed. Refresh and review the current submission.');
      return this.mutate(result.publicKey, 'approveMilestone', [index, input.expectedRevision, expectedHash], { client: this.wallet().publicKey, creator: publicKey(result.deal.creator), deal: result.publicKey });
    });
  }

  openDispute(address: string, reason: string): Promise<MutationResult> {
    return this.guarded(async () => {
      this.wallet();
      text(reason, 'Dispute reason', 200);
      const result = await this.raw(address);
      this.role(result.deal, [result.deal.client, result.deal.creator]);
      this.state(result.deal, 'active');
      return this.mutate(result.publicKey, 'openDispute', [reason], { party: this.wallet().publicKey, deal: result.publicKey });
    });
  }

  resolveDispute(address: string, outcome: Resolution, reason: string): Promise<MutationResult> {
    return this.guarded(async () => {
      this.wallet();
      resolution(outcome);
      text(reason, 'Resolution reason', 200);
      const result = await this.raw(address);
      this.role(result.deal, [result.deal.arbiter]);
      this.state(result.deal, 'disputed');
      if (outcome === 'pay_current' && (result.deal.currentMilestone === null || !result.deal.milestones[result.deal.currentMilestone].submission)) throw new BazaarSdkError('invalid_state', 'The current milestone must have a submitted result before it can be paid.');
      const variants: Record<Resolution, string> = { pay_current: 'payCurrent', refund: 'refund', creator_breach: 'creatorBreach' };
      return this.mutate(result.publicKey, 'resolveDispute', [{ [variants[outcome]]: {} }, reason], { arbiter: this.wallet().publicKey, client: publicKey(result.deal.client), creator: publicKey(result.deal.creator), deal: result.publicKey });
    });
  }

  cancelUnaccepted(address: string): Promise<MutationResult> {
    return this.guarded(async () => {
      this.wallet();
      const result = await this.raw(address);
      this.role(result.deal, [result.deal.client]);
      this.state(result.deal, 'awaiting_creator');
      return this.mutate(result.publicKey, 'cancelUnaccepted', [], { client: this.wallet().publicKey, deal: result.publicKey });
    });
  }
}

/** Pass useAnchorWallet() ?? null and useConnection().connection from wallet-adapter. */
export function createBazaarClient(options: BazaarClientOptions): BazaarClient {
  return new Client(options);
}
