# Part 1 status

Status: IN PROGRESS — source implemented; SBF build, integration tests and deployment pending.
Owner: @am1cs (macOS).
Branch: codex/part-1-contract-sdk.

## Verified

- Shared API v1 and role boundaries documented.
- All seven Anchor instructions implemented against the shared API v1.
- Native Rust build and seven unit tests passed.
- SDK typecheck and 53 unit tests passed. Genuine compiler IDL bundled.
- All seven IDL instructions serialize; largest maximum-field transaction is 825 bytes.
- Integration-test source typechecks; actual on-chain execution is pending.
- Genuine IDL generated; SBF build is running. Program is not deployed yet.

## Next checkpoint

Working build, Devnet deployment, read/create/accept SDK methods.

## Handoff

Program ID reserved: 8ddYBcE1uxzxke9T9ivLqXN9gJiXNY5kGbNYwBfiqCgX (not deployed yet).
IDL: generated and published in contracts/idl/aic_bazaar.json and sdk/src/idl.json.
PR: none.
Test results: seven native Rust tests and 53 SDK unit tests passed; on-chain integration not run yet.

## Blockers

Devnet RPC faucet returned an internal error and rate limit. Dedicated deployer
wg7zLEvr1EYuhimLDMTYGnqbMwDoeaKd8CXcZteCPup needs test SOL for deployment.
Local validator testing continues independently.

Update this file with verified results and remaining blockers at each checkpoint.
