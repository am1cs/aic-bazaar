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

## Deployment evidence

Pending execution. Do not interpret this document as a completed deployment.

| Evidence | Verified value |
| --- | --- |
| Program ID / deployed cluster | Pending root deployment |
| Upgrade authority | Pending verification |
| Program binary SHA-256 and source commit | Pending build evidence |
| Generated IDL location | `contracts/target/idl/aic_bazaar.json`; generated from Rust, deployed matching pending |
| Actual integration-test run | Not yet run |
| Completed demonstration deal | Pending real transactions |
| Resolved demonstration deal | Pending real transactions |

The owner fills verified public addresses, transaction signatures and Explorer
links after deployment. The public `deployment/devnet.json` must contain no
private keys, API credentials or funded production wallets.

## Handoff to the frontend owner

Use `createBazaarClient` from `@aic-bazaar/sdk`, not direct Anchor account parsing.
Obtain the actual constructor types and IDL/program manifest from the SDK handoff.
Use integer base-10 lamport strings, submit the expected revision/hash, and show
success only after confirmed transactions. A confirmed transaction followed by a
failed account refresh is a confirmed receipt requiring refresh, not permission
to pay again. An uncertain confirmation must be checked by signature first.
