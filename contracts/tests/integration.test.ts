import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import anchor from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';
import {
  ComputeBudgetProgram, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram,
  Transaction, sendAndConfirmTransaction,
} from '@solana/web3.js';

const { AnchorProvider, BN, Program, Wallet } = anchor;
type EnumValue = Record<string, Record<string, never>>;
interface MilestoneAccount {
  amountLamports: anchor.BN;
  dueAt: anchor.BN;
  url: string;
  sha256: number[];
  revision: number;
  submittedAt: anchor.BN;
  paidAt: anchor.BN;
}
interface DealAccount {
  client: PublicKey;
  creator: PublicKey;
  arbiter: PublicKey;
  title: string;
  brief: string;
  referencesUrl: string;
  templateVersion: number;
  budgetLamports: anchor.BN;
  bondLamports: anchor.BN;
  remainingBudgetLamports: anchor.BN;
  lockedBondLamports: anchor.BN;
  rentReserveLamports: anchor.BN;
  status: EnumValue;
  currentMilestone: number;
  milestones: MilestoneAccount[];
  disputeOpenedBy: PublicKey;
  disputeReason: string;
  resolutionOutcome: EnumValue;
  resolutionReason: string;
  resolvedAt: anchor.BN;
}
type Accounts = Record<string, PublicKey>;
const amount = (value: anchor.BN): bigint => BigInt(value.toString());
const enumName = (value: EnumValue): string => Object.keys(value)[0]!;
const hash = (value: string): number[] => [...createHash('sha256').update(value).digest()];
const maxUrl = (): string => 'https://example.com/'.padEnd(200, 'a');

test('compiled AIC Bazaar program enforces escrow and role rules', { timeout: 600_000 }, async (t) => {
  const rpc = process.env.AIC_RPC_URL ?? 'http://127.0.0.1:8899';
  const endpoint = new URL(rpc);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
  const devnet = endpoint.protocol === 'https:' && endpoint.hostname === 'api.devnet.solana.com';
  assert(local || devnet, 'Tests permit only a local validator or the public Solana Devnet RPC');
  const connection = new Connection(rpc, 'confirmed');
  const idlPath = path.resolve(process.env.AIC_IDL_PATH ?? 'target/idl/aic_bazaar.json');
  const idl = JSON.parse(await readFile(idlPath, 'utf8')) as Idl;
  const programId = new PublicKey(process.env.AIC_PROGRAM_ID ?? idl.address);
  assert.equal(programId.toBase58(), idl.address, 'IDL must identify the program actually under test');
  const executable = await connection.getAccountInfo(programId);
  assert(executable?.executable, 'An executable program deployment is required; mocks are not a test substitute');

  const payer = process.env.AIC_TEST_PAYER
    ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(process.env.AIC_TEST_PAYER, 'utf8'))))
    : Keypair.generate();
  if (!process.env.AIC_TEST_PAYER) {
    assert(local, 'Devnet requires an explicitly provided ignored test-payer keypair file');
    const signature = await connection.requestAirdrop(payer.publicKey, 5 * LAMPORTS_PER_SOL);
    const validity = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction({ signature, ...validity }, 'confirmed');
  }
  assert(await connection.getBalance(payer.publicKey) > 3 * LAMPORTS_PER_SOL,
    'Test payer needs more than 3 test SOL for isolated actor funding and account rent');
  const actors = { client: Keypair.generate(), creator: Keypair.generate(), arbiter: Keypair.generate(), outsider: Keypair.generate() };
  const funding = new Transaction();
  for (const [name, actor] of Object.entries(actors)) {
    funding.add(SystemProgram.transfer({
      fromPubkey: payer.publicKey, toPubkey: actor.publicKey,
      lamports: name === 'client' ? 2 * LAMPORTS_PER_SOL : name === 'creator' ? 0.2 * LAMPORTS_PER_SOL : 0.02 * LAMPORTS_PER_SOL,
    }));
  }
  await sendAndConfirmTransaction(connection, funding, [payer], { commitment: 'confirmed' });
  const provider = new AnchorProvider(connection, new Wallet(payer), { commitment: 'confirmed' });
  const program = new Program(idl, provider);
  // Raw IDL methods keep these tests independent of SDK validation and normalization.
  const methods = program.methods as unknown as Record<string, (...args: any[]) => any>;
  const dealAccounts = program.account as unknown as { deal: { fetch: (address: PublicKey) => Promise<DealAccount> } };
  const readDeal = (address: PublicKey): Promise<DealAccount> => dealAccounts.deal.fetch(address);
  const balance = async (address: PublicKey): Promise<bigint> => BigInt(await connection.getBalance(address));
  const tracked = Object.values(actors).map((actor) => actor.publicKey);
  let transactionNonce = 0;
  const send = async (method: string, args: unknown[], accounts: Accounts, signer: Keypair): Promise<string> => {
    const keys = [...tracked, accounts.deal!];
    const before = await Promise.all(keys.map(balance));
    const signature = await methods[method]!(...args).accountsStrict(accounts)
      // Distinct message for each call prevents same-blockhash replay being mistaken
      // for a second execution when checking double-payment and terminal guards.
      .preInstructions([ComputeBudgetProgram.setComputeUnitPrice({ microLamports: ++transactionNonce })])
      .signers([signer]).rpc();
    const after = await Promise.all(keys.map(balance));
    const sum = (values: bigint[]): bigint => values.reduce((total, value) => total + value, 0n);
    assert.equal(sum(after), sum(before), `${method} did not conserve participant plus escrow lamports`);
    const state = await readDeal(accounts.deal!);
    const rent = amount(state.rentReserveLamports);
    const obligations = amount(state.remainingBudgetLamports) + amount(state.lockedBondLamports);
    assert(after.at(-1)! >= rent + obligations, `${method} left escrow unable to meet obligations`);
    return signature;
  };
  const approveAccounts = (address: PublicKey): Accounts => ({
    client: actors.client.publicKey, creator: actors.creator.publicKey, deal: address,
  });
  const resolveAccounts = (address: PublicKey): Accounts => ({
    arbiter: actors.arbiter.publicKey, client: actors.client.publicKey,
    creator: actors.creator.publicKey, deal: address,
  });
  const actorAccounts = (role: 'client' | 'creator' | 'party', address: PublicKey, actor: Keypair): Accounts => ({
    [role]: actor.publicKey, deal: address,
  });
  const unchangedAfterFailure = async (action: () => Promise<unknown>, address?: PublicKey): Promise<void> => {
    const keys = address ? [...tracked, address] : tracked;
    const before = await Promise.all(keys.map(balance));
    const dataBefore = address ? (await connection.getAccountInfo(address))?.data.toString('base64') : undefined;
    await assert.rejects(action, (error: unknown) => {
      assert(error instanceof Error, 'Expected a program rejection, not a non-error value');
      assert.match(error.message, /AnchorError|custom program error|Error Code|Error Number|Transaction simulation failed/,
        'Negative test failed before reaching the program or due to an unrelated RPC error');
      return true;
    });
    assert.deepEqual(await Promise.all(keys.map(balance)), before, 'A rejected action changed participant/escrow balances');
    if (address) assert.equal((await connection.getAccountInfo(address))?.data.toString('base64'), dataBefore,
      'A rejected action changed stored deal state');
  };
  const freshId = (): anchor.BN => new BN(randomBytes(8), 'le');
  const derive = (id: anchor.BN): PublicKey => PublicKey.findProgramAddressSync([
    Buffer.from('deal'), actors.client.publicKey.toBuffer(), id.toArrayLike(Buffer, 'le', 8),
  ], programId)[0];
  interface CreateOptions {
    budget?: bigint; title?: string; brief?: string; referencesUrl?: string;
    creator?: PublicKey; arbiter?: PublicKey; deadlines?: number[];
  }
  const createArgs = (id: anchor.BN, options: CreateOptions = {}): unknown[] => {
    const now = Math.floor(Date.now() / 1000);
    return [id, options.creator ?? actors.creator.publicKey, options.arbiter ?? actors.arbiter.publicKey,
      options.title ?? 'Devnet test advertisement', options.brief ?? 'A 15-second vertical ad with an agreed CTA.',
      options.referencesUrl ?? '', new BN((options.budget ?? 30_000_007n).toString()),
      (options.deadlines ?? [now + 3600, now + 7200, now + 10_800]).map((value) => new BN(value))];
  };
  const createAccounts = (address: PublicKey): Accounts => ({
    client: actors.client.publicKey, deal: address, systemProgram: SystemProgram.programId,
  });
  const create = async (options: CreateOptions = {}): Promise<PublicKey> => {
    const id = freshId();
    const address = derive(id);
    const prior = await balance(actors.client.publicKey);
    await send('createDeal', createArgs(id, options), createAccounts(address), actors.client);
    const account = await readDeal(address);
    const raw = await connection.getAccountInfo(address);
    assert(raw && raw.owner.equals(programId), 'Deal is not owned by the actual tested program');
    assert.equal(raw.data.length, 1904, 'Account allocation must cover all bounded maximum fields');
    assert.equal(amount(account.rentReserveLamports), BigInt(await connection.getMinimumBalanceForRentExemption(raw.data.length)));
    assert.equal(enumName(account.status), 'awaitingCreator');
    assert.equal(account.currentMilestone, 0);
    assert.equal(account.templateVersion, 1);
    assert.equal(amount(account.remainingBudgetLamports), options.budget ?? 30_000_007n);
    assert.equal(amount(account.lockedBondLamports), 0n);
    assert.equal(await balance(address), amount(account.rentReserveLamports) + amount(account.remainingBudgetLamports));
    assert.equal(prior - await balance(actors.client.publicKey), await balance(address));
    return address;
  };
  const accept = async (address: PublicKey): Promise<void> => {
    await send('acceptDeal', [], { ...actorAccounts('creator', address, actors.creator), systemProgram: SystemProgram.programId }, actors.creator);
  };
  const submit = async (address: PublicKey, index: number, revision = 0, value = `stage-${index}`): Promise<number[]> => {
    const fingerprint = hash(value);
    await send('submitMilestone', [index, `https://example.com/${value}.mp4`, fingerprint, revision], actorAccounts('creator', address, actors.creator), actors.creator);
    return fingerprint;
  };
  const approve = async (address: PublicKey, index: number, fingerprint: number[], revision = 1): Promise<void> => {
    await send('approveMilestone', [index, revision, fingerprint], approveAccounts(address), actors.client);
  };
  const dispute = async (address: PublicKey, actor = actors.client): Promise<void> => {
    await send('openDispute', ['Please review the agreed milestone requirements.'], actorAccounts('party', address, actor), actor);
  };
  const resolve = async (address: PublicKey, outcome: string): Promise<void> => {
    await send('resolveDispute', [{ [outcome]: {} }, 'Reviewed the brief and submitted evidence.'], resolveAccounts(address), actors.arbiter);
  };
  const cancel = async (address: PublicKey): Promise<void> => {
    await send('cancelUnaccepted', [], actorAccounts('client', address, actors.client), actors.client);
  };
  const assertEscrow = async (address: PublicKey, donation = 0n): Promise<void> => {
    const account = await readDeal(address);
    assert.equal(await balance(address), amount(account.rentReserveLamports) +
      amount(account.remainingBudgetLamports) + amount(account.lockedBondLamports) + donation);
  };

  await t.test('complete all milestones; odd budget rounding, donation and rent remain correct', async () => {
    const address = await create();
    const original = await readDeal(address);
    const clientBefore = await balance(actors.client.publicKey);
    const creatorBefore = await balance(actors.creator.publicKey);
    await accept(address);
    assert.equal(creatorBefore - await balance(actors.creator.publicKey), amount(original.bondLamports));
    assert.equal(enumName((await readDeal(address)).status), 'active');
    const donation = 12345n;
    await sendAndConfirmTransaction(connection, new Transaction().add(SystemProgram.transfer({
      fromPubkey: payer.publicKey, toPubkey: address, lamports: Number(donation),
    })), [payer], { commitment: 'confirmed' });
    const expected = [6_000_001n, 9_000_002n, 15_000_004n];
    for (let index = 0; index < 3; index++) {
      const fingerprint = await submit(address, index);
      const beforePayment = await balance(actors.creator.publicKey);
      await approve(address, index, fingerprint);
      const state = await readDeal(address);
      assert.equal(amount(state.milestones[index]!.amountLamports), expected[index]);
      assert(amount(state.milestones[index]!.paidAt) > 0n);
      assert.equal(await balance(actors.creator.publicKey) - beforePayment,
        expected[index]! + (index === 2 ? amount(original.bondLamports) : 0n));
      await assertEscrow(address, donation);
    }
    const final = await readDeal(address);
    assert.equal(enumName(final.status), 'completed');
    assert.equal(final.currentMilestone, 3);
    assert.equal(amount(final.remainingBudgetLamports), 0n);
    assert.equal(amount(final.lockedBondLamports), 0n);
    assert.equal(await balance(actors.creator.publicKey) - creatorBefore, 30_000_007n);
    assert.equal(await balance(actors.client.publicKey), clientBefore);
    assert(final.milestones.every((stage) => stage.revision === 1 && stage.url.startsWith('https://')));
    await unchangedAfterFailure(() => approve(address, 2, hash('stage-2')), address);
    await unchangedAfterFailure(() => dispute(address), address);
    await unchangedAfterFailure(() => submit(address, 2, 1, 'changed-paid-file'), address);
    await unchangedAfterFailure(() => resolve(address, 'refund'), address);
  });

  await t.test('cancel before acceptance refunds only budget and preserves rent', async () => {
    const address = await create();
    const before = await balance(actors.client.publicKey);
    await cancel(address);
    assert.equal(await balance(actors.client.publicKey) - before, 30_000_007n);
    const state = await readDeal(address);
    assert.equal(enumName(state.status), 'cancelled');
    assert.equal(state.currentMilestone, 3);
    await assertEscrow(address);
    await unchangedAfterFailure(() => accept(address), address);
    await unchangedAfterFailure(() => cancel(address), address);
  });

  for (const outcome of ['payCurrent', 'refund', 'creatorBreach']) {
    await t.test(`dispute outcome ${outcome} preserves first payment and settles remaining obligations`, async () => {
      const address = await create({ budget: 30_000_000n });
      await accept(address);
      await approve(address, 0, await submit(address, 0));
      await submit(address, 1);
      const paidMaterial = (await readDeal(address)).milestones[0]!;
      await dispute(address, actors.creator);
      const clientBefore = await balance(actors.client.publicKey);
      const creatorBefore = await balance(actors.creator.publicKey);
      await resolve(address, outcome);
      assert.equal(await balance(actors.client.publicKey) - clientBefore,
        outcome === 'payCurrent' ? 15_000_000n : outcome === 'creatorBreach' ? 27_000_000n : 24_000_000n);
      assert.equal(await balance(actors.creator.publicKey) - creatorBefore,
        outcome === 'payCurrent' ? 12_000_000n : outcome === 'refund' ? 3_000_000n : 0n);
      const state = await readDeal(address);
      assert.equal(enumName(state.status), 'resolved');
      assert.equal(enumName(state.resolutionOutcome), outcome);
      assert.equal(state.currentMilestone, 3);
      assert(amount(state.resolvedAt) > 0n);
      assert.equal(state.milestones[0]!.url, paidMaterial.url);
      assert.deepEqual(state.milestones[0]!.sha256, paidMaterial.sha256);
      assert.equal(amount(state.milestones[0]!.paidAt), amount(paidMaterial.paidAt));
      assert.equal(amount(state.milestones[1]!.paidAt) > 0n, outcome === 'payCurrent');
      await assertEscrow(address);
      await unchangedAfterFailure(() => resolve(address, outcome), address);
      await unchangedAfterFailure(() => submit(address, 1, 1), address);
      await unchangedAfterFailure(() => approve(address, 1, hash('stage-1')), address);
    });
  }

  await t.test('foreign signers and substituted payout recipients cannot move escrow', async () => {
    const address = await create();
    await unchangedAfterFailure(() => send('acceptDeal', [], {
      ...actorAccounts('creator', address, actors.outsider), systemProgram: SystemProgram.programId,
    }, actors.outsider), address);
    await unchangedAfterFailure(() => send('cancelUnaccepted', [], actorAccounts('client', address, actors.outsider), actors.outsider), address);
    await accept(address);
    const fingerprint = await submit(address, 0);
    await unchangedAfterFailure(() => send('submitMilestone', [0, 'https://example.com/foreign', fingerprint, 1],
      actorAccounts('creator', address, actors.outsider), actors.outsider), address);
    await unchangedAfterFailure(() => send('approveMilestone', [0, 1, fingerprint],
      { ...approveAccounts(address), client: actors.outsider.publicKey }, actors.outsider), address);
    await unchangedAfterFailure(() => send('approveMilestone', [0, 1, fingerprint],
      { ...approveAccounts(address), creator: actors.outsider.publicKey }, actors.client), address);
    await unchangedAfterFailure(() => send('openDispute', ['Unauthorized dispute.'],
      actorAccounts('party', address, actors.outsider), actors.outsider), address);
    await dispute(address);
    await unchangedAfterFailure(() => send('resolveDispute', [{ refund: {} }, 'Unauthorized resolution.'],
      { ...resolveAccounts(address), arbiter: actors.outsider.publicKey }, actors.outsider), address);
    for (const recipient of ['client', 'creator']) {
      await unchangedAfterFailure(() => send('resolveDispute', [{ refund: {} }, 'Recipient substitution.'],
        { ...resolveAccounts(address), [recipient]: actors.outsider.publicKey }, actors.arbiter), address);
    }
    await resolve(address, 'refund');
  });

  await t.test('reject early, skipped, double, stale approvals; exactly one replacement allowed', async () => {
    const address = await create();
    await unchangedAfterFailure(() => submit(address, 0), address);
    await unchangedAfterFailure(() => approve(address, 0, hash('stage-0')), address);
    await accept(address);
    await unchangedAfterFailure(() => accept(address), address);
    await unchangedAfterFailure(() => cancel(address), address);
    await unchangedAfterFailure(() => approve(address, 0, hash('stage-0')), address);
    await unchangedAfterFailure(() => submit(address, 1), address);
    const original = await submit(address, 0);
    await unchangedAfterFailure(() => submit(address, 0, 0, 'stale-replacement'), address);
    const replacement = await submit(address, 0, 1, 'replacement');
    await unchangedAfterFailure(() => send('submitMilestone', [0, 'https://example.com/third', hash('third'), 2],
      actorAccounts('creator', address, actors.creator), actors.creator), address);
    await unchangedAfterFailure(() => approve(address, 0, original, 1), address);
    await unchangedAfterFailure(() => approve(address, 0, original, 2), address);
    await unchangedAfterFailure(() => approve(address, 0, replacement, 1), address);
    await unchangedAfterFailure(() => approve(address, 1, replacement, 2), address);
    await approve(address, 0, replacement, 2);
    await unchangedAfterFailure(() => approve(address, 0, replacement, 2), address);
    await unchangedAfterFailure(() => submit(address, 0, 1, 'paid-replacement'), address);
    // The identical hash on a later stage must not make a stale earlier approval valid.
    await send('submitMilestone', [1, 'https://example.com/same-file', replacement, 0],
      actorAccounts('creator', address, actors.creator), actors.creator);
    await unchangedAfterFailure(() => approve(address, 0, replacement, 1), address);
    await approve(address, 1, replacement);
    await approve(address, 2, await submit(address, 2));
    await assertEscrow(address);
  });

  await t.test('disputes freeze ordinary actions and pay_current needs a submission', async () => {
    const address = await create();
    await accept(address);
    await unchangedAfterFailure(() => resolve(address, 'refund'), address);
    await dispute(address);
    await unchangedAfterFailure(() => submit(address, 0), address);
    await unchangedAfterFailure(() => approve(address, 0, hash('stage-0')), address);
    await unchangedAfterFailure(() => dispute(address, actors.creator), address);
    await unchangedAfterFailure(() => resolve(address, 'payCurrent'), address);
    await unchangedAfterFailure(() => send('resolveDispute', [{ refund: {} }, '   '],
      resolveAccounts(address), actors.arbiter), address);
    await resolve(address, 'refund');
    await assertEscrow(address);

    const submitted = await create();
    await accept(submitted);
    const fingerprint = await submit(submitted, 0);
    await dispute(submitted);
    await unchangedAfterFailure(() => submit(submitted, 0, 1, 'frozen'), submitted);
    await unchangedAfterFailure(() => approve(submitted, 0, fingerprint), submitted);
    await resolve(submitted, 'refund');
  });

  await t.test('on-chain input validation rejects bounds, blank terms, roles and invalid URLs', async () => {
    const now = Math.floor(Date.now() / 1000);
    const invalid: CreateOptions[] = [
      { budget: 999_999n }, { budget: 1_000_000_001n }, { title: '' }, { brief: '   ' },
      { title: 'a'.repeat(65) }, { brief: 'a'.repeat(201) }, { referencesUrl: maxUrl() + 'a' },
      { title: '😀'.repeat(17) }, { referencesUrl: 'http://example.com/reference' },
      { referencesUrl: 'https://' }, { referencesUrl: 'https://example.com/file with spaces' },
      { referencesUrl: 'https://user@example.com/file' },
      { deadlines: [now - 10, now + 3600, now + 7200] },
      { deadlines: [now + 3600, now + 3600, now + 7200] },
      { deadlines: [now + 7200, now + 3600, now + 10_800] },
      { creator: actors.client.publicKey }, { arbiter: actors.client.publicKey },
      { arbiter: actors.creator.publicKey }, { creator: PublicKey.default }, { arbiter: PublicKey.default },
    ];
    for (const options of invalid) {
      const id = freshId();
      const address = derive(id);
      await unchangedAfterFailure(() => send('createDeal', createArgs(id, options), createAccounts(address), actors.client));
      assert.equal(await connection.getAccountInfo(address), null, 'Rejected creation left an initialized escrow');
    }
    const address = await create({ budget: 1_000_000n });
    await accept(address);
    for (const [index, url] of [[0, 'http://example.com/file'], [0, maxUrl() + 'x'], [3, 'https://example.com/file']] as const) {
      await unchangedAfterFailure(() => send('submitMilestone', [index, url, hash('file'), 0],
        actorAccounts('creator', address, actors.creator), actors.creator), address);
    }
    await unchangedAfterFailure(() => send('openDispute', [''], actorAccounts('party', address, actors.client), actors.client), address);
    await unchangedAfterFailure(() => send('openDispute', ['a'.repeat(201)], actorAccounts('party', address, actors.client), actors.client), address);
    await dispute(address);
    await resolve(address, 'refund');
  });

  await t.test('an underfunded named creator cannot activate the deal or lock a partial bond', async () => {
    const poorCreator = Keypair.generate();
    await sendAndConfirmTransaction(connection, new Transaction().add(SystemProgram.transfer({
      fromPubkey: payer.publicKey, toPubkey: poorCreator.publicKey, lamports: 1_000_000,
    })), [payer], { commitment: 'confirmed' });
    const address = await create({ creator: poorCreator.publicKey });
    const before = await balance(poorCreator.publicKey);
    await unchangedAfterFailure(() => send('acceptDeal', [], {
      creator: poorCreator.publicKey, deal: address, systemProgram: SystemProgram.programId,
    }, poorCreator), address);
    assert.equal(await balance(poorCreator.publicKey), before);
    assert.equal(enumName((await readDeal(address)).status), 'awaitingCreator');
    await cancel(address);
  });

  await t.test('maximum valid payloads fit 1232-byte transactions and retain original terms', async () => {
    const id = freshId();
    const address = derive(id);
    const options = { title: 'a'.repeat(64), brief: 'b'.repeat(200), referencesUrl: maxUrl(), budget: 1_000_000_000n };
    const balancesBeforeCreate = await Promise.all([...tracked, address].map(balance));
    const maxCreate = await methods.createDeal!(...createArgs(id, options)).accountsStrict(createAccounts(address)).transaction() as Transaction;
    maxCreate.feePayer = payer.publicKey;
    maxCreate.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    maxCreate.sign(payer, actors.client);
    assert(maxCreate.serialize().length <= 1232, `Max create size ${maxCreate.serialize().length} exceeds Solana packet limit`);
    await provider.sendAndConfirm(maxCreate, [actors.client]);
    const balancesAfterCreate = await Promise.all([...tracked, address].map(balance));
    assert.equal(balancesAfterCreate.reduce((a, b) => a + b, 0n), balancesBeforeCreate.reduce((a, b) => a + b, 0n));
    await assertEscrow(address);
    await accept(address);
    const maxSubmit = await methods.submitMilestone!(0, maxUrl(), hash('maximum'), 0)
      .accountsStrict(actorAccounts('creator', address, actors.creator)).transaction() as Transaction;
    maxSubmit.feePayer = payer.publicKey;
    maxSubmit.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    maxSubmit.sign(payer, actors.creator);
    assert(maxSubmit.serialize().length <= 1232);
    const balancesBeforeSubmit = await Promise.all([...tracked, address].map(balance));
    await provider.sendAndConfirm(maxSubmit, [actors.creator]);
    assert.deepEqual(await Promise.all([...tracked, address].map(balance)), balancesBeforeSubmit);
    await assertEscrow(address);
    await send('openDispute', ['d'.repeat(200)], actorAccounts('party', address, actors.creator), actors.creator);
    await send('resolveDispute', [{ refund: {} }, 'r'.repeat(200)], resolveAccounts(address), actors.arbiter);
    const state = await readDeal(address);
    assert.equal(state.title, options.title);
    assert.equal(state.brief, options.brief);
    assert.equal(state.referencesUrl, options.referencesUrl);
    assert.equal(state.disputeReason.length, 200);
    assert.equal(state.resolutionReason.length, 200);
    assert.equal(state.milestones[0]!.url.length, 200);
    await assertEscrow(address);
  });
});
