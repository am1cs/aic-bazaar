# AIC Bazaar technical handoff

## Architecture and boundaries

The product uses Solana Devnet and test SOL. The Anchor program owns each deal
PDA, which holds immutable terms, the milestone and dispute history, and escrow
lamports. The named customer funds the full budget; the named creator posts a
ten-percent performance deposit. The SDK reads state from Solana and exposes the
dependency-free boundary in `shared/api.ts` to the frontend.

Documents and videos stay off-chain behind HTTPS links. A SHA-256 fingerprint
identifies a submitted file version; it does not establish authorship, acceptable
quality, or copyright ownership. The browser computes the fingerprint locally.

The three milestone amounts are `floor(budget*20/100)`,
`floor(budget*30/100)`, and the remaining budget, calculated in integer lamports.
The performance deposit is `floor(budget/10)`. There is no platform fee in v1.
Rent and unsolicited transfers are not escrow obligations. Already-paid material
references remain in the deal account when the deal closes.

## Human trust and limitations

- The deal names a trusted human arbiter before the creator accepts. The arbiter
  can close a disputed deal using one of three specified outcomes; they cannot
  redirect funds to an arbitrary third party or reverse earlier payouts.
- The program upgrade authority can change program code. The deployment manifest
  and final handoff must identify the public upgrade authority address.
- Deadlines and the 24-hour review period are informational. There is no automatic
  payment or deadline fine. Opening a dispute is the escalation mechanism.
- No legal IP transfer, independent arbitration network, AI quality assessment,
  fiat payment gateway, embedded wallet, or mainnet readiness is claimed.
- Test actor wallets are for Devnet only. Their secret keys are never checked into
  this repository or printed in logs.

## Reproducible program tests

From `contracts/`, run `npm ci` and `npm run typecheck`.
The integration suite invokes program instructions directly, so it checks the
program's enforcement independently of the SDK and frontend.

Run with a deployed program and generated IDL:

```sh
AIC_RPC_URL=http://127.0.0.1:8899 \
AIC_PROGRAM_ID=8ddYBcE1uxzxke9T9ivLqXN9gJiXNY5kGbNYwBfiqCgX \
AIC_IDL_PATH=target/idl/aic_bazaar.json \
npm test
```

On a local validator the suite creates an ephemeral transaction payer and asks the
local faucet for test SOL. For Devnet, use `AIC_RPC_URL=https://api.devnet.solana.com`
and `AIC_TEST_PAYER=/absolute/path/to/an/ignored/devnet-keypair.json`. The suite
refuses mainnet and any unexpected network. `AIC_TEST_PAYER` is a local path, not a
key value. Do not put it in a committed environment file.

The payer pays network fees separately from deal participants. This allows exact
assertions on customer/creator payouts without silently treating fees as escrow.
The suite uses fresh actor keys and unique deal IDs, creates real accounts, and
retains their histories. A Devnet run therefore consumes test SOL for rent and
fees and should be budgeted accordingly.

Covered scenarios include completion and rounding, cancellation, all three dispute
outcomes, signer and recipient substitution, double/early/stale approvals, revision
limits, frozen disputed state, terminal states, balance conservation, unsolicited
transfers, and maximum transaction sizes.

Each successful instruction asserts conservation of participant and escrow
balances, excluding the separate transaction fee payer. Rejected instructions
must report an actual program/simulation error and leave participant balances and
deal bytes unchanged. Duplicate-action tests vary a tiny compute-unit price to
produce distinct transaction messages, so a cached previously confirmed signature
cannot accidentally stand in for a second execution.

The runner writes public transaction signatures and execution metrics to ignored
`contracts/target/test-reports/integration.json`. Override the destination using
`AIC_TEST_REPORT_PATH`. This metrics file is not a substitute for the TAP output
and successful process exit status.

## Verified local-validator results

On 13 October 2026 at 01:52 Asia/Almaty, the actual compiled executable program
passed all 11 integration scenarios plus their parent harness (12 TAP tests,
zero failures, zero skipped tests), in 32.477 seconds. The run confirmed **65
program transactions** and checked **73 rejected program attempts** through the
validator's program execution/preflight. These are local-validator results;
rejections checked in preflight are not claimed as on-chain ledger transactions.

Maximum-field transaction serialization measured **921 bytes for creation** and
**546 bytes for submission**, each below Solana's 1232-byte packet limit. The
created deal accounts are **1904 bytes**, and the test checks their owner and
actual rent-exempt reserve against RPC. Completion keeps an unsolicited 12,345
lamport transfer outside payout obligations. All dispute outcomes retain the
previously paid result and settle remaining budget and bond as specified.

The public transaction list and deal addresses in the generated report require
this local validator to be running. They are not public Devnet demonstration
links.

## Deployment evidence

The Devnet program was deployed on 13 October 2026 at 01:52:15 Asia/Almaty.
Its downloaded binary matches the actual compiled artifact tested locally.
Two additional complete SDK workflows were executed and verified on public Devnet.

| Evidence | Verified value |
| --- | --- |
| Program ID / deployed cluster | [8ddYBcE1uxzxke9T9ivLqXN9gJiXNY5kGbNYwBfiqCgX](https://explorer.solana.com/address/8ddYBcE1uxzxke9T9ivLqXN9gJiXNY5kGbNYwBfiqCgX?cluster=devnet), executable on Devnet |
| Upgrade authority | `wg7zLEvr1EYuhimLDMTYGnqbMwDoeaKd8CXcZteCPup`, verified through the upgradeable program account |
| Program binary SHA-256 and source commit | `897ab1b6352186e7d4b36982eb726cd24a529a2b33726b2ec9b4ec8fc437769f`; source commit `80c1d8e02a483e42e8e3a2b37cdf4788c06edc5f` |
| Generated IDL location | `contracts/idl/aic_bazaar.json`; byte-identical to `sdk/src/idl.json` and final compiler output |
| Actual integration-test run | Local 12/12 TAP tests passed; 65 confirmed program transactions, 73 rejected attempts |
| Actual SDK integration | Local five scenarios passed; 53 unit tests and seven native Rust tests also passed |
| Completed demonstration deal | [E6z3ZUSy9up26ttcYUDXUBWhGGpbw1y6trfHN4W61C8d](https://explorer.solana.com/address/E6z3ZUSy9up26ttcYUDXUBWhGGpbw1y6trfHN4W61C8d?cluster=devnet) |
| Resolved demonstration deal | [98jXr37FrE4wYP7ZMzyXY9ELsDhhtdTsqz4wHnsyUUMN](https://explorer.solana.com/address/98jXr37FrE4wYP7ZMzyXY9ELsDhhtdTsqz4wHnsyUUMN?cluster=devnet) |

`deployment/demo-transactions.json` contains 16 confirmed Devnet receipts;
`deployment/verification.json` independently checks them plus the deployment
receipt, terminal account states, file fingerprints and actual balance deltas.
The completed order pays 0.06 SOL, 0.09 SOL, then 0.15 SOL plus the returned
0.03 SOL bond. The refund outcome returns 0.24 SOL to the customer and the
0.03 SOL bond to the creator, preserving the paid concept.

GLOW is a fictional brand. `deployment/demo-assets/` contains the original
synthetic storyboard and 15-second vertical MP4 examples with SHA-256 fingerprints.
They are demonstration fixtures, not real clients or evidence of paid demand.
A setup run with a wrong asset commit was explicitly retired via the dispute
refund path. Its receipts are retained in `deployment/retired-demo-transactions.json`
and are not used as the final demo deals. The seed script now verifies the Git
commit and published file hashes before creating any deal.

## Reproduce on a fresh local machine

Install Rust, Agave 2.3.0, Anchor CLI 0.32.1 and Node.js 22+ from their official
sources. Run the following from `contracts/` to compile the locked program:

```sh
cargo build-sbf --manifest-path programs/aic-bazaar/Cargo.toml
mkdir -p target/idl target/types
anchor idl build -o target/idl/aic_bazaar.json -t target/types/aic_bazaar.ts
```

Start a fresh local validator from the repository root in a separate terminal:

```sh
solana-test-validator --ledger .local/repro-ledger --bind-address 127.0.0.1 \
  --bpf-program 8ddYBcE1uxzxke9T9ivLqXN9gJiXNY5kGbNYwBfiqCgX \
  contracts/target/deploy/aic_bazaar.so
```

This loads the compiled program directly into the local test ledger; no private
key for the public Devnet deployment is needed. Run the raw suite as above.
The direct SBF build was also checked from a clean source archive with no owner
keys: its SHA-256 matches both the original build and the public Devnet binary.
For the SDK suite, generate your own ignored test payer and fund it on localnet:

```sh
bash deployment/setup-local-keys.sh
solana --url http://127.0.0.1:8899 --keypair .local/keys/test-payer.json airdrop 100
cd sdk
npm ci
AIC_RUN_SDK_INTEGRATION=1 npm run test:chain
```

Only the deployment owner can upgrade the existing Devnet program using its
ignored local keys. Public demo verification needs no wallet or private key:

```sh
npm --prefix contracts ci
npm --prefix sdk ci
contracts/node_modules/.bin/tsx deployment/verify-demo.mts
```

Creating another pair of demo deals is an owner action using
`AIC_ASSET_COMMIT=<published-asset-commit> contracts/node_modules/.bin/tsx deployment/seed-demo.mts`.
The script stops if a receipt file already exists; inspect existing signatures
and states before any retry. Public RPC calls are paced, and uncertain signed
transactions are not automatically submitted again.

## Handoff to the frontend owner

Use `createBazaarClient` from `@aic-bazaar/sdk`, not direct Anchor account parsing.
Obtain the actual constructor types and IDL/program manifest from the SDK handoff.
Use integer base-10 lamport strings, submit the expected revision/hash, and show
success only after confirmed transactions. A confirmed transaction followed by a
failed account refresh is a confirmed receipt requiring refresh, not permission
to pay again. An uncertain confirmation must be checked by signature first.
