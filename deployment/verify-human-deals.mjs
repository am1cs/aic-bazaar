// Read-only Devnet verification. Run after `npm ci` in sdk/:
// node deployment/verify-human-deals.mjs [dealAddress ...]
// With no addresses, also discover up to ten deals for the supplied human test pair.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(root, 'sdk/package.json'));
const { Connection, PublicKey } = require('@solana/web3.js');
const { Program } = require('@coral-xyz/anchor');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'deployment/devnet.json'), 'utf8'));
const idl = JSON.parse(fs.readFileSync(path.join(root, 'contracts/idl/aic_bazaar.json'), 'utf8'));
assert.equal(manifest.cluster, 'devnet');
assert.equal(manifest.rpcUrl, 'https://api.devnet.solana.com');
assert.equal(idl.address, manifest.programId);
const connection = new Connection(manifest.rpcUrl, { commitment: 'confirmed', disableRetryOnRateLimit: true });
const program = new Program(idl, { connection }); // No wallet or signing method.
const known = {
  completed: 'qQHGbT4YgPGArdtPX3wLjVc5fWSrzSSkCHSM4FpAmnV',
  refunded: 'FtFChaQZEEdPuTnkVeXGxk4JHE5fku6u3qicVN4hyz7b',
};
const participantPair = {
  client: 'RoBbvk9K1mKvpn8HymvYFb46386YRUFqhUfTrjo2TT4',
  creator: '8Et821ouFKAf9nLgGgXZmRQNZ1LGGN7sLvMD8VTXp18W',
};
const enumName = value => Object.keys(value)[0];
const decimal = value => {
  const text = value.toString();
  assert.match(text, /^\d+$/);
  return text;
};
const amount = value => BigInt(decimal(value));
const numericLamports = value => {
  assert.ok(Number.isSafeInteger(value) && value >= 0, 'RPC balance exceeds safe integer precision.');
  return BigInt(value);
};
const timestamp = value => {
  const result = Number(decimal(value));
  assert.ok(Number.isSafeInteger(result));
  return result;
};
const iso = value => value === null ? null : new Date(value * 1000).toISOString();
let lastRpcAt = 0;
async function rpc(call) {
  const delay = Math.max(0, 1100 - (Date.now() - lastRpcAt));
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  lastRpcAt = Date.now();
  return call();
}

assert.equal(await rpc(() => connection.getGenesisHash()), 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG');
const requested = process.argv.slice(2);
let discovery = { performed: false, method: null, addresses: [] };
if (!requested.length) {
  // The discriminator (8) and deal ID (8) precede the two fixed public keys.
  const matches = await rpc(() => connection.getProgramAccounts(new PublicKey(manifest.programId), {
    commitment: 'confirmed', dataSlice: { offset: 0, length: 0 },
    filters: [
      { memcmp: { offset: 16, bytes: participantPair.client } },
      { memcmp: { offset: 48, bytes: participantPair.creator } },
    ],
  }));
  assert.ok(matches.length <= 10, 'More than ten matching deals; rerun with explicit addresses.');
  discovery = {
    performed: true, method: 'program accounts filtered by client and creator',
    addresses: matches.map(entry => entry.pubkey.toBase58()),
  };
}
const addresses = [...new Set(requested.length ? requested : [...Object.values(known), ...discovery.addresses])];
assert.ok(addresses.length <= 10, 'At most ten addresses per verification run.');
const verified = [];

for (const address of addresses) {
  const key = new PublicKey(address);
  const response = await rpc(() => connection.getAccountInfoAndContext(key));
  assert.ok(response.value, `Missing deal account: ${address}`);
  assert.equal(response.value.owner.toBase58(), manifest.programId);
  assert.equal(response.value.executable, false);
  const raw = program.coder.accounts.decode('deal', response.value.data);
  assert.equal(raw.templateVersion, 1);
  const roles = { client: raw.client.toBase58(), creator: raw.creator.toBase58(), arbiter: raw.arbiter.toBase58() };
  assert.equal(new Set(Object.values(roles)).size, 3);
  const budget = amount(raw.budgetLamports);
  const bond = amount(raw.bondLamports);
  const rent = amount(raw.rentReserveLamports);
  const remaining = amount(raw.remainingBudgetLamports);
  const locked = amount(raw.lockedBondLamports);
  const balance = numericLamports(response.value.lamports);
  assert.equal(bond, budget / 10n);
  assert.equal(raw.milestones.length, 3);
  const stageAmounts = [budget * 20n / 100n, budget * 30n / 100n];
  stageAmounts.push(budget - stageAmounts[0] - stageAmounts[1]);
  raw.milestones.forEach((entry, index) => assert.equal(amount(entry.amountLamports), stageAmounts[index]));
  assert.ok(balance >= rent + remaining + locked, 'Escrow obligations are underfunded.');
  const histories = await rpc(() => connection.getSignaturesForAddress(key, { limit: 30 }));
  assert.ok(histories.length < 30, 'History bound reached; complete pagination is required.');
  const transactions = [];
  let replayBudget = 0n;
  let replayBond = 0n;
  let replayStatus = null;
  let replayIndex = 0;
  const revisions = [0, 0, 0];
  const submissions = [null, null, null];
  const paid = [false, false, false];
  let replayResolution = null;
  let creations = 0;
  for (const history of histories.toReversed()) {
    const tx = await rpc(() => connection.getParsedTransaction(history.signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 }));
    assert.ok(tx?.meta, `Unavailable transaction: ${history.signature}`);
    const keys = tx.transaction.message.accountKeys;
    const instructions = tx.transaction.message.instructions.filter(ix => ix.programId.toBase58() === manifest.programId);
    if (!instructions.length) continue; // An unsolicited transfer is not an escrow operation.
    assert.deepEqual(tx.meta.err, history.err);
    assert.ok(['confirmed', 'finalized'].includes(history.confirmationStatus));
    if (tx.meta.err !== null) {
      transactions.push({ signature: history.signature, slot: history.slot, blockTime: iso(tx.blockTime), successful: false, error: tx.meta.err });
      continue;
    }
    assert.equal(instructions.length, 1, 'Expected one escrow operation per receipt.');
    const instruction = instructions[0];
    assert.ok('data' in instruction);
    const decoded = program.coder.instruction.decode(instruction.data, 'base58');
    assert.ok(decoded);
    const definition = program.idl.instructions.find(ix => ix.name === decoded.name);
    assert.ok(definition);
    const accounts = Object.fromEntries(definition.accounts.map((entry, index) => [entry.name, instruction.accounts[index].toBase58()]));
    assert.equal(accounts.deal, address);
    for (const [role, publicKey] of Object.entries(roles)) {
      if (accounts[role]) assert.equal(accounts[role], publicKey, `Unexpected ${role} recipient.`);
    }
    const signers = keys.filter(entry => entry.signer).map(entry => entry.pubkey.toBase58());
    const feePayer = keys[0].pubkey.toBase58();
    const fee = numericLamports(tx.meta.fee);
    const expected = { client: 0n, creator: 0n, arbiter: 0n, escrow: 0n };
    let signingRole;
    switch (decoded.name) {
      case 'createDeal':
        signingRole = 'client';
        assert.equal(creations++, 0);
        assert.equal(amount(decoded.data.budgetLamports), budget);
        assert.equal(decoded.data.creator.toBase58(), roles.creator);
        assert.equal(decoded.data.arbiter.toBase58(), roles.arbiter);
        replayBudget = budget;
        replayStatus = 'awaitingCreator';
        expected.client -= budget + rent;
        expected.escrow += budget + rent;
        break;
      case 'acceptDeal':
        signingRole = 'creator';
        assert.equal(replayStatus, 'awaitingCreator');
        replayStatus = 'active';
        replayBond = bond;
        expected.creator -= bond;
        expected.escrow += bond;
        break;
      case 'submitMilestone': {
        signingRole = 'creator';
        assert.equal(replayStatus, 'active');
        const index = decoded.data.index;
        assert.equal(index, replayIndex);
        assert.equal(decoded.data.expectedRevision, revisions[index]);
        assert.ok(revisions[index] < 2);
        revisions[index]++;
        submissions[index] = { url: decoded.data.url, sha256: Buffer.from(decoded.data.sha256).toString('hex') };
        break;
      }
      case 'approveMilestone': {
        signingRole = 'client';
        assert.equal(replayStatus, 'active');
        const index = decoded.data.index;
        assert.equal(index, replayIndex);
        assert.equal(decoded.data.expectedRevision, revisions[index]);
        assert.ok(revisions[index] > 0);
        assert.equal(Buffer.from(decoded.data.expectedHash).toString('hex'), submissions[index].sha256);
        const payment = stageAmounts[index] + (index === 2 ? replayBond : 0n);
        expected.creator += payment;
        expected.escrow -= payment;
        replayBudget -= stageAmounts[index];
        paid[index] = true;
        if (index === 2) { replayBond = 0n; replayStatus = 'completed'; }
        else replayIndex++;
        break;
      }
      case 'openDispute':
        signingRole = Object.entries(roles).find(([role, publicKey]) => role !== 'arbiter' && publicKey === accounts.party)?.[0];
        assert.ok(signingRole, 'Dispute signer must be client or creator.');
        assert.equal(replayStatus, 'active');
        replayStatus = 'disputed';
        break;
      case 'resolveDispute': {
        signingRole = 'arbiter';
        assert.equal(replayStatus, 'disputed');
        const outcome = enumName(decoded.data.outcome);
        const currentPayment = outcome === 'payCurrent' ? stageAmounts[replayIndex] : 0n;
        if (outcome === 'payCurrent') { assert.ok(revisions[replayIndex] > 0); paid[replayIndex] = true; }
        assert.ok(['payCurrent', 'refund', 'creatorBreach'].includes(outcome));
        expected.creator += currentPayment + (outcome === 'creatorBreach' ? 0n : replayBond);
        expected.client += replayBudget - currentPayment + (outcome === 'creatorBreach' ? replayBond : 0n);
        expected.escrow -= replayBudget + replayBond;
        replayBudget = 0n;
        replayBond = 0n;
        replayStatus = 'resolved';
        replayResolution = outcome;
        break;
      }
      case 'cancelUnaccepted':
        signingRole = 'client';
        assert.equal(replayStatus, 'awaitingCreator');
        expected.client += replayBudget;
        expected.escrow -= replayBudget;
        replayBudget = 0n;
        replayStatus = 'cancelled';
        break;
      default: throw new Error(`Unsupported instruction: ${decoded.name}`);
    }
    assert.ok(signers.includes(roles[signingRole]), 'Required role did not sign.');
    const feeRole = Object.entries(roles).find(([, publicKey]) => publicKey === feePayer)?.[0];
    assert.ok(feeRole, 'This verifier expects a participant to pay the network fee.');
    expected[feeRole] -= fee;
    const deltas = {};
    for (const [role, publicKey] of Object.entries({ ...roles, escrow: address })) {
      const index = keys.findIndex(entry => entry.pubkey.toBase58() === publicKey);
      const delta = index < 0 ? 0n : numericLamports(tx.meta.postBalances[index]) - numericLamports(tx.meta.preBalances[index]);
      assert.equal(delta, expected[role], `${decoded.name}: unexpected ${role} balance delta.`);
      deltas[`${role}DeltaLamports`] = delta.toString();
    }
    transactions.push({
      signature: history.signature, slot: history.slot, blockTime: iso(tx.blockTime), confirmationStatus: history.confirmationStatus, successful: true,
      operation: decoded.name, milestoneIndex: decoded.data.index ?? null,
      expectedRevision: decoded.data.expectedRevision ?? null, outcome: decoded.data.outcome ? enumName(decoded.data.outcome) : null,
      signingRole, signers, feePayer, feeLamports: fee.toString(), ...deltas,
    });
  }
  assert.equal(creations, 1, 'Complete history must include creation.');
  assert.equal(replayStatus, enumName(raw.status));
  assert.equal(replayBudget, remaining);
  assert.equal(replayBond, locked);
  if (!['completed', 'resolved', 'cancelled'].includes(replayStatus)) assert.equal(replayIndex, raw.currentMilestone);
  raw.milestones.forEach((entry, index) => {
    assert.equal(entry.revision, revisions[index]);
    assert.equal(timestamp(entry.paidAt) > 0, paid[index]);
    if (submissions[index]) {
      assert.equal(entry.url, submissions[index].url);
      assert.equal(Buffer.from(entry.sha256).toString('hex'), submissions[index].sha256);
    }
  });
  if (replayStatus === 'resolved') assert.equal(replayResolution, enumName(raw.resolutionOutcome));
  if (address === known.completed) {
    assert.equal(replayStatus, 'completed');
    assert.deepEqual(revisions, [1, 2, 1]);
    assert.equal(transactions.filter(tx => tx.successful).length, 9);
    assert.equal(budget, 10_000_000n);
  }
  if (address === known.refunded) {
    assert.equal(replayStatus, 'resolved');
    assert.equal(replayResolution, 'refund');
    assert.deepEqual(paid, [true, false, false]);
    assert.equal(transactions.filter(tx => tx.successful).length, 6);
    assert.equal(budget, 20_000_000n);
  }
  verified.push({
    address, owner: manifest.programId, readContextSlot: response.context.slot, ...roles,
    title: raw.title, createdAt: iso(timestamp(raw.createdAt)), status: enumName(raw.status),
    resolutionOutcome: replayResolution, budgetLamports: budget.toString(), bondLamports: bond.toString(),
    remainingBudgetLamports: remaining.toString(), lockedBondLamports: locked.toString(),
    rentReserveLamports: rent.toString(), accountBalanceLamports: balance.toString(),
    unsolicitedExcessLamports: (balance - rent - remaining - locked).toString(),
    milestones: raw.milestones.map((entry, index) => ({
      index, amountLamports: decimal(entry.amountLamports), revision: entry.revision, paidAt: paid[index] ? iso(timestamp(entry.paidAt)) : null,
      submission: entry.revision ? { url: entry.url, sha256: Buffer.from(entry.sha256).toString('hex'), submittedAt: iso(timestamp(entry.submittedAt)) } : null,
    })),
    transactions,
  });
}
const knownLatest = Math.max(...verified.filter(entry => Object.values(known).includes(entry.address)).map(entry => Date.parse(entry.createdAt)));
discovery.newerThanKnownHumanDeals = discovery.addresses.filter(address => {
  const entry = verified.find(deal => deal.address === address);
  return entry && !Object.values(known).includes(address) && Date.parse(entry.createdAt) > knownLatest;
});
const evidence = {
  cluster: 'devnet', verifiedAt: new Date().toISOString(), rpcUrl: manifest.rpcUrl, programId: manifest.programId,
  readOnly: true, discovery, successfulReceiptsChecked: verified.reduce((count, entry) => count + entry.transactions.filter(tx => tx.successful).length, 0),
  scope: 'Public account state, complete bounded receipt history, required signers, integer obligations and transaction balance deltas. No wallet signing, UI acceptance, file delivery or media-content validation.',
  deals: verified,
};
const output = path.join(root, 'deployment/human-verification.json');
fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ verifiedAt: evidence.verifiedAt, successfulReceiptsChecked: evidence.successfulReceiptsChecked, discovery, deals: verified.map(({ address, status, resolutionOutcome, remainingBudgetLamports, lockedBondLamports, accountBalanceLamports }) => ({ address, status, resolutionOutcome, remainingBudgetLamports, lockedBondLamports, accountBalanceLamports })), output }, null, 2));
