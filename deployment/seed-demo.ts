import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createBazaarClient, type TransactionWallet } from '../sdk/src/index';

const root = fileURLToPath(new URL('../', import.meta.url));
const requireSdk = createRequire(path.join(root, 'sdk/package.json'));
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } = requireSdk('@solana/web3.js');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const programId = new PublicKey('8ddYBcE1uxzxke9T9ivLqXN9gJiXNY5kGbNYwBfiqCgX');
const loadKey = (name: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(root, '.local/keys', `${name}.json`), 'utf8'))));
const payer = loadKey('deployer');
const customer = loadKey('demo-client');
const creator = loadKey('demo-creator');
const arbiter = loadKey('arbiter');
const wallet = (key: typeof customer): TransactionWallet => ({
  publicKey: key.publicKey,
  async signTransaction<T>(transaction: T): Promise<T> {
    (transaction as unknown as { partialSign(key: typeof customer): void }).partialSign(key);
    return transaction;
  },
  async signAllTransactions<T>(transactions: T[]): Promise<T[]> {
    for (const transaction of transactions) (transaction as unknown as { partialSign(key: typeof customer): void }).partialSign(key);
    return transactions;
  },
});
const clientSdk = createBazaarClient({ connection, wallet: wallet(customer), programId });
const creatorSdk = createBazaarClient({ connection, wallet: wallet(creator), programId });
const arbiterSdk = createBazaarClient({ connection, wallet: wallet(arbiter), programId });
const output = path.join(root, 'deployment/demo-transactions.json');
if (fs.existsSync(output)) throw new Error('Demo receipt file already exists. Inspect its deals before creating more.');
const commit = process.env.AIC_ASSET_COMMIT;
if (!commit || !/^[0-9a-f]{40}$/.test(commit)) throw new Error('Set AIC_ASSET_COMMIT to the published commit containing the demo assets.');
const records: Array<Record<string, unknown>> = [];
const deals: Record<string, string> = {};
const persist = () => fs.writeFileSync(output, JSON.stringify({ cluster: 'devnet', programId: programId.toBase58(), assetCommit: commit, deals, transactions: records }, null, 2) + '\n');
const receipt = (operation: string, result: Awaited<ReturnType<typeof clientSdk.createDeal>>) => {
  records.push({ operation, signature: result.signature, dealAddress: result.dealAddress });
  persist();
  if (!result.deal) throw new Error(`Confirmed ${operation}, but refresh failed. Receipt saved; inspect before retrying.`);
  return result.deal;
};

// Funding is explicitly Devnet, with our isolated local test keys only.
const fund = new Transaction();
for (const [actor, minimum] of [[customer, 750_000_000], [creator, 60_000_000], [arbiter, 5_000_000]] as const) {
  const balance = await connection.getBalance(actor.publicKey);
  if (balance < minimum) fund.add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: actor.publicKey, lamports: minimum - balance }));
}
if (fund.instructions.length) {
  const signature = await sendAndConfirmTransaction(connection, fund, [payer], { commitment: 'confirmed' });
  records.push({ operation: 'fund_demo_wallets', signature });
  persist();
}
const files = ['concept.svg', 'draft.mp4', 'final.mp4'];
const materials = files.map(file => ({
  url: `https://github.com/am1cs/aic-bazaar/blob/${commit}/deployment/demo-assets/${file}`,
  sha256: createHash('sha256').update(fs.readFileSync(path.join(root, 'deployment/demo-assets', file))).digest('hex'),
}));
const makeDeal = async (name: string) => {
  const now = Math.floor(Date.now() / 1000);
  const result = await clientSdk.createDeal({
    title: `GLOW — ${name} demo`,
    brief: 'Synthetic fictional-brand ad. Three approved keyframes, 15-second vertical draft, final 1080x1920 MP4 with CREATE YOUR MOMENT CTA. Demonstration only; no commercial customer.',
    referencesUrl: materials[0].url,
    creator: creator.publicKey.toBase58(), arbiter: arbiter.publicKey.toBase58(),
    budgetLamports: '300000000', deadlines: [now + 86400, now + 172800, now + 259200],
  });
  deals[name] = result.dealAddress;
  receipt(`${name}:create`, result);
  receipt(`${name}:accept`, await creatorSdk.acceptDeal(result.dealAddress));
  return result.dealAddress;
};
const completed = await makeDeal('completed');
for (const index of [0, 1, 2] as const) {
  receipt(`completed:submit:${index}`, await creatorSdk.submitMilestone({ address: completed, index, expectedRevision: 0, ...materials[index] }));
  receipt(`completed:approve:${index}`, await clientSdk.approveMilestone({ address: completed, index, expectedRevision: 1, expectedHash: materials[index].sha256 }));
}
const resolved = await makeDeal('resolved');
receipt('resolved:submit:0', await creatorSdk.submitMilestone({ address: resolved, index: 0, expectedRevision: 0, ...materials[0] }));
receipt('resolved:approve:0', await clientSdk.approveMilestone({ address: resolved, index: 0, expectedRevision: 1, expectedHash: materials[0].sha256 }));
receipt('resolved:submit:1', await creatorSdk.submitMilestone({ address: resolved, index: 1, expectedRevision: 0, ...materials[1] }));
receipt('resolved:dispute', await clientSdk.openDispute(resolved, 'Demo scenario: campaign paused after concept approval; parties disagree about proceeding with the draft.'));
receipt('resolved:refund', await arbiterSdk.resolveDispute(resolved, 'refund', 'Demo settlement: retain paid concept, refund remaining 0.24 SOL to client, and return 0.03 SOL bond; no creator breach.'));
const [completedDeal, resolvedDeal] = await Promise.all([clientSdk.getDeal(completed), clientSdk.getDeal(resolved)]);
if (completedDeal.status !== 'completed' || resolvedDeal.status !== 'resolved') throw new Error('Unexpected terminal demo states.');
for (const deal of [completedDeal, resolvedDeal]) {
  if (deal.remainingBudgetLamports !== '0' || deal.lockedBondLamports !== '0') throw new Error('Demo escrow still has outstanding obligations.');
}
persist();
console.log(JSON.stringify({ programId: programId.toBase58(), completed, resolved, confirmedReceipts: records.length }, null, 2));
