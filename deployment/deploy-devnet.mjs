import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const solana = process.env.AIC_SOLANA_CLI ?? path.join(root, '.local/tools/agave/bin/solana');
const binary = path.join(root, 'contracts/target/deploy/aic_bazaar.so');
const keys = path.join(root, '.local/keys');
for (const file of [binary, ...['program', 'deployer', 'deployment-buffer'].map(name => path.join(keys, `${name}.json`))]) {
  if (!existsSync(file)) throw new Error(`Required local file is missing: ${path.relative(root, file)}`);
}
// Explicit Devnet URL and explicit buffer key avoid creating a recovery phrase in CLI output.
const result = spawnSync(solana, [
  '--url', 'https://api.devnet.solana.com', '--keypair', '.local/keys/deployer.json',
  'program', 'deploy', binary,
  '--program-id', '.local/keys/program.json',
  '--upgrade-authority', '.local/keys/deployer.json',
  '--buffer', '.local/keys/deployment-buffer.json',
  '--max-len', String(statSync(binary).size), '--max-sign-attempts', '10',
], { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
// Never echo arbitrary CLI output that could contain wallet recovery material.
for (const line of `${result.stdout ?? ''}\n${result.stderr ?? ''}`.split('\n')) {
  if (/^(Program Id:|Signature:|Error:|Program deployed)/.test(line.trim())) console.log(line.trim());
}
if (result.error) console.error(`Deployment could not execute: ${result.error.message}`);
if (result.status !== 0) {
  console.error('Devnet deployment failed. Check the public payer balance, RPC availability, and required local files.');
  process.exitCode = result.status ?? 1;
}
