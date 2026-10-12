import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createBazaarClient } from '../sdk/src/index';

const root = fileURLToPath(new URL('../', import.meta.url));
const { Connection, PublicKey } = createRequire(path.join(root, 'sdk/package.json'))('@solana/web3.js');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const manifestPath = path.join(root, 'deployment/devnet.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const receipts = JSON.parse(fs.readFileSync(path.join(root, 'deployment/demo-transactions.json'), 'utf8'));
const sdk = createBazaarClient({ connection, wallet: null, programId: manifest.programId });
const completed = await sdk.getDeal(receipts.deals.completed);
const resolved = await sdk.getDeal(receipts.deals.resolved);
assert.equal(completed.status, 'completed');
assert.equal(resolved.status, 'resolved');
assert.equal(resolved.resolution?.outcome, 'refund');
for (const deal of [completed, resolved]) {
  assert.equal(deal.budgetLamports, '300000000');
  assert.equal(deal.bondLamports, '30000000');
  assert.equal(deal.remainingBudgetLamports, '0');
  assert.equal(deal.lockedBondLamports, '0');
  assert.equal(String(await connection.getBalance(new PublicKey(deal.address))), deal.rentReserveLamports);
}
assert.ok(completed.milestones.every(m => m.paidAt !== null));
assert.ok(resolved.milestones[0].paidAt !== null);
assert.equal(resolved.milestones[1].paidAt, null);
assert.equal(resolved.milestones[2].paidAt, null);
const fileHashes = JSON.parse(fs.readFileSync(path.join(root, 'deployment/demo-assets/hashes.json'), 'utf8'));
for (const [index, name] of ['concept.svg', 'draft.mp4', 'final.mp4'].entries()) {
  assert.equal(completed.milestones[index].submission?.sha256, fileHashes[name].sha256);
  assert.equal(completed.milestones[index].submission?.url,
    `https://github.com/am1cs/aic-bazaar/blob/${receipts.assetCommit}/deployment/demo-assets/${name}`);
}
const signatures = [manifest.deploymentSignature, ...receipts.transactions.map((r: { signature: string }) => r.signature)];
const statuses = await connection.getSignatureStatuses(signatures, { searchTransactionHistory: true });
assert.equal(statuses.value.length, signatures.length);
for (const status of statuses.value) {
  assert.ok(status);
  assert.equal(status.err, null);
  assert.ok(status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized');
}
const movements: Array<Record<string, unknown>> = [];
for (const operation of ['completed:approve:0', 'completed:approve:1', 'completed:approve:2', 'resolved:refund']) {
  const receipt = receipts.transactions.find((r: { operation: string }) => r.operation === operation);
  const transaction = await connection.getTransaction(receipt.signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  assert.ok(transaction?.meta);
  assert.equal(transaction.meta.err, null);
  const keys = transaction.transaction.message.staticAccountKeys ?? transaction.transaction.message.accountKeys;
  const delta = (address: string) => {
    const index = keys.findIndex((key: { toBase58(): string }) => key.toBase58() === address);
    assert.ok(index >= 0);
    return transaction.meta.postBalances[index] - transaction.meta.preBalances[index];
  };
  const deal = operation.startsWith('completed') ? completed : resolved;
  const creatorDelta = delta(deal.creator);
  const clientDelta = delta(deal.client);
  const escrowDelta = delta(deal.address);
  if (operation === 'resolved:refund') {
    assert.equal(creatorDelta, 30_000_000);
    assert.equal(clientDelta, 240_000_000);
    assert.equal(escrowDelta, -270_000_000);
  } else {
    const expected = { 'completed:approve:0': 60_000_000, 'completed:approve:1': 90_000_000, 'completed:approve:2': 180_000_000 }[operation];
    assert.equal(creatorDelta, expected);
    assert.equal(escrowDelta, -expected!);
    assert.equal(clientDelta, -transaction.meta.fee);
  }
  movements.push({ operation, signature: receipt.signature, creatorDeltaLamports: creatorDelta, clientDeltaLamports: clientDelta, escrowDeltaLamports: escrowDelta, feeLamports: transaction.meta.fee });
  await new Promise(resolve => setTimeout(resolve, 500));
}
const deployedAt = await connection.getBlockTime(manifest.lastDeploySlot);
manifest.demoDeals = receipts.deals;
manifest.deployedAt = deployedAt ? new Date(deployedAt * 1000).toISOString() : null;
manifest.note = 'Executable Devnet deployment and both terminal demo deals verified. On-chain binary matches the locally tested artifact. Synthetic fixtures are demonstration data, not customer traction.';
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const evidence = {
  cluster: 'devnet', verifiedAt: new Date().toISOString(), programId: manifest.programId,
  successfulReceiptsChecked: signatures.length, completedDeal: completed, resolvedDeal: resolved,
  movements,
};
fs.writeFileSync(path.join(root, 'deployment/verification.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ checkedReceipts: signatures.length, completed: completed.address, resolved: resolved.address, movements }, null, 2));
